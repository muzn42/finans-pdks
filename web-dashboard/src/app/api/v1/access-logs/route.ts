import { NextRequest, NextResponse } from "next/server";
import { errorDetail, requireUser, STAFF_ROLES } from "@/lib/api-guard";

/** Geçiş simülatörü (kart/QR/geofence) yalnızca İK, BT ve Admin tarafından kullanılabilir. */
const SIMULATOR_ROLES = ["HR", "IT", "ADMIN"] as const;
import { prisma } from "@/lib/prisma";
import {
  AccessLogCreateSchema,
  isSuspiciousGpsAccuracy,
  normalizeBssid,
  parseBssidList
} from "@/lib/validators";
import { calculateAttendanceMetrics, hhmmFromMin, minFromHhmm } from "@/lib/pdks-engine";
import { toIstanbulDate, toIstanbulTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  CHECK_IN: "Sabah Giriş (Check-In)",
  LUNCH_OUT: "Öğle Arası Çıkış",
  LUNCH_IN: "Öğle Arası Dönüş",
  BREAK_OUT: "Kısa Mola Çıkışı",
  BREAK_IN: "Kısa Mola Dönüşü",
  CHECK_OUT: "Akşam Çıkış (Check-Out)"
};

function parseNearbyWifisJson(raw: string | null | undefined): Array<{
  bssid: string;
  ssid?: string;
  rssi?: number;
}> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireUser(req, STAFF_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const { searchParams } = new URL(req.url);
    const empId = searchParams.get("employeeId");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 80)));

    const where = empId ? { employeeId: Number(empId) } : {};
    const rows = await prisma.accessLog.findMany({
      where,
      include: {
        employee: {
          select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
        }
      },
      orderBy: { timestampUtc: "desc" },
      take: limit
    });

    return NextResponse.json({
      status: "success",
      count: rows.length,
      accessLogs: rows.map((a) => ({
        id: a.id,
        empId: a.employeeId,
        sicil: a.employee.sicil,
        name: a.employee.name,
        dept: a.employee.dept,
        branch: a.branchCode,
        eventType: a.eventType,
        eventLabel: EVENT_LABELS[a.eventType] || a.eventType,
        source: a.source,
        distanceMeters: a.distanceMeters,
        accuracyMeters: a.accuracyMeters,
        isMockGps: a.isMockGps,
        nearbyWifis: parseNearbyWifisJson(a.nearbyWifisJson),
        matchedBssid: a.matchedBssid,
        wifiStatus: a.wifiStatus,
        note: a.note,
        timestampUtc: a.timestampUtc.toISOString(),
        timeIstanbul: toIstanbulTime(a.timestampUtc),
        dateIstanbul: toIstanbulDate(a.timestampUtc)
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "AccessLogs kayıtları alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req, SIMULATOR_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const parsed = AccessLogCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz geçiş verisi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const emp = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: { shift: true }
    });

    if (!emp) {
      return NextResponse.json(
        { status: "error", message: "Personel bulunamadı." },
        { status: 404 }
      );
    }

    const targetBranchCode = data.branchCode || emp.branchCode;
    const branch = await prisma.branch.findUnique({
      where: { code: targetBranchCode }
    });
    const allowedRadius = branch?.radiusMeters ?? 30.0;

    // 1. Taze Konum + location.mocked + GPS Accuracy (Sapma Küsuratı) + 30m Geofence Kontrolü
    const isMockFlag = Boolean(data.isMockGps || data.locationMocked);
    const isStaleFix = (data.locationAgeMs ?? 0) > 15000 && data.source === "MOBILE_GEOFENCE";
    const isFakeAccuracy =
      data.source === "MOBILE_GEOFENCE" &&
      data.accuracyMeters !== undefined &&
      isSuspiciousGpsAccuracy(data.accuracyMeters);
    const isOutOfGeofence = data.distanceMeters > allowedRadius;

    // 2. Bağlantısız Pasif Wi-Fi BSSID Çapraz Kontrolü (loadWifiList / nearbyWifis)
    const nearbyWifis = (data.nearbyWifis || []).map((w) => ({
      bssid: normalizeBssid(w.bssid),
      ssid: w.ssid || "",
      rssi: typeof w.rssi === "number" ? w.rssi : -65
    })).filter((w) => Boolean(w.bssid));

    const primaryBssid = normalizeBssid(branch?.wifiBssid);
    const backupBssids = parseBssidList(branch?.backupWifiBssids);
    const branchEnforcement = branch?.wifiEnforcementMode || "LEARNING";

    let matchedBssid: string | null = null;
    let wifiStatus = "LEARNING";

    if (primaryBssid && nearbyWifis.some((w) => w.bssid === primaryBssid)) {
      matchedBssid = primaryBssid;
      wifiStatus = "VERIFIED_PRIMARY";
    } else if (backupBssids.length > 0) {
      const hitBackup = nearbyWifis.find((w) => backupBssids.includes(w.bssid));
      if (hitBackup) {
        matchedBssid = hitBackup.bssid;
        wifiStatus = "VERIFIED_BACKUP";
      }
    }

    if (!matchedBssid) {
      if (primaryBssid || backupBssids.length > 0) {
        wifiStatus = branchEnforcement === "STRICT" ? "BLOCKED_BSSID" : "UNVERIFIED_LOGGED";
      } else {
        wifiStatus = "LEARNING";
      }
    }

    const isStrictWifiMismatch =
      data.source === "MOBILE_GEOFENCE" &&
      branchEnforcement === "STRICT" &&
      Boolean(primaryBssid || backupBssids.length > 0) &&
      !matchedBssid;

    if (isMockFlag || isFakeAccuracy || isStaleFix || isOutOfGeofence || isStrictWifiMismatch) {
      let alertType = "30m sınır aşımı";
      let blockReason = `${data.distanceMeters.toFixed(1)}m > ${allowedRadius.toFixed(1)}m şube sınırı aşıldı.`;

      if (isMockFlag) {
        alertType = "Sahte GPS (Mock)";
        blockReason = "location.mocked === true (Sahte konum / Geliştirici Seçenekleri hilesi yakalandı).";
      } else if (isFakeAccuracy) {
        alertType = "Sahte GPS (Sabit Accuracy)";
        blockReason = `Yapay GPS sapma değeri tespit edildi (accuracy: ${Number(data.accuracyMeters).toFixed(5)} m — küsuratsız sabit tam sayı).`;
      } else if (isStaleFix) {
        alertType = "Sahte GPS (Önbellek Konumu)";
        blockReason = `Taze olmayan önbellek konumu reddedildi (maximumAge: 0 ihlali, yaş: ${Math.round((data.locationAgeMs || 0) / 1000)} sn).`;
      } else if (isStrictWifiMismatch) {
        alertType = "Kurumsal Wi-Fi dışı";
        blockReason = `Şube BSSID (${primaryBssid || backupBssids[0]}) etraftaki Wi-Fi taramasında (${nearbyWifis.length} modem) görülmedi!`;
      }

      const alertCode = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const alert = await prisma.securityAlert.create({
        data: {
          code: alertCode,
          employeeId: emp.id,
          branchCode: targetBranchCode,
          alertType,
          severity: "HIGH",
          distanceMeters: data.distanceMeters,
          status: "OPEN"
        }
      });

      sseHub.broadcast({
        type: "SECURITY_ALERT",
        title: `Güvenlik İhlali: ${alertType}`,
        message: `${emp.name} (${emp.sicil}) · ${blockReason}`,
        severity: "bad",
        data: {
          id: alert.code,
          empId: emp.id,
          sicil: emp.sicil,
          name: emp.name,
          dept: emp.dept,
          branch: targetBranchCode,
          type: alertType,
          sev: "HIGH",
          dist: data.distanceMeters,
          status: "OPEN"
        }
      });

      return NextResponse.json(
        {
          status: "blocked",
          message: `${alertType}: ${blockReason} İşlem engellendi ve BT Güvenlik Radarına alarm üretildi.`,
          alertCode,
          wifiStatus
        },
        { status: 403 }
      );
    }

    // 2. UTC zaman damgası üretimi
    const now = new Date();
    let timestampUtc = now;
    let clockMin =
      minFromHhmm(data.clockHhmm) ??
      minFromHhmm(toIstanbulTime(now)) ??
      8 * 60 + 30;

    if (data.clockHhmm) {
      const parsedMin = minFromHhmm(data.clockHhmm);
      if (parsedMin != null) {
        clockMin = parsedMin;
        const baseDayUtc = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
        );
        // Europe/Istanbul GMT+3 -> UTC = clockMin - 180 dk
        timestampUtc = new Date(baseDayUtc.getTime() + (clockMin - 180) * 60000);
      }
    }

    const workDateIstanbul = toIstanbulDate(timestampUtc); // DD.MM.YYYY
    const [dd, mm, yyyy] = workDateIstanbul.split(".");
    const workDateIso = dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : timestampUtc.toISOString().slice(0, 10);

    const effectiveAccuracy =
      data.accuracyMeters != null && Number.isFinite(data.accuracyMeters)
        ? Number(data.accuracyMeters)
        : Number((2.8413 + ((emp.id * 17) % 53) * 0.1137).toFixed(4));

    const { accessLog, updatedEmp } = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.accessLog.create({
        data: {
          employeeId: emp.id,
          eventType: data.eventType,
          source: data.source,
          branchCode: targetBranchCode,
          distanceMeters: data.distanceMeters,
          accuracyMeters: effectiveAccuracy,
          isMockGps: false,
          nearbyWifisJson: JSON.stringify(nearbyWifis),
          matchedBssid,
          wifiStatus,
          note: data.note || EVENT_LABELS[data.eventType] || data.eventType,
          timestampUtc
        }
      });

      // 3. İlk giriş (checkIn) ve son çıkış (checkOut) güncellemesi + Onaylı Saatlik İzin kontrolü
      let nextInMin = emp.inMin;
      let nextOutMin = emp.outMin;

      if (data.eventType === "CHECK_IN") {
        nextInMin = nextInMin == null ? clockMin : Math.min(nextInMin, clockMin);
      } else if (data.eventType === "CHECK_OUT") {
        nextOutMin = nextOutMin == null ? clockMin : Math.max(nextOutMin, clockMin);
      }

      const approvedHourlyLeaves = await tx.leaveRequest.findMany({
        where: {
          employeeId: emp.id,
          isHourly: true,
          status: "APPROVED",
          startDate: { in: [workDateIstanbul, workDateIso] }
        }
      });
      const approvedHourlyMin = approvedHourlyLeaves.reduce(
        (acc, l) => acc + (l.durationMin || 0),
        0
      );

      const calc = calculateAttendanceMetrics({
        inMin: nextInMin,
        outMin: nextOutMin,
        shiftStartMin: emp.shift?.startMin ?? 510,
        shiftEndMin: emp.shift?.endMin ?? 1050,
        shiftGraceMin: emp.shift?.graceMin ?? 5,
        shiftBreakMin: emp.shift?.breakMin ?? 60,
        approvedHourlyLeaveMin: approvedHourlyMin
      });

      const empAfter = await tx.employee.update({
        where: { id: emp.id },
        data: {
          status: calc.status,
          inMin: nextInMin,
          outMin: nextOutMin,
          checkIn: hhmmFromMin(nextInMin),
          checkOut: hhmmFromMin(nextOutMin),
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          distMeters: data.distanceMeters
        },
        include: { shift: true }
      });

      await tx.dailyAttendance.upsert({
        where: {
          employeeId_workDate: {
            employeeId: emp.id,
            workDate: workDateIso
          }
        },
        update: {
          inMin: nextInMin,
          outMin: nextOutMin,
          workedMin: calc.workedMin,
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          hourlyLeaveMin: approvedHourlyMin,
          distanceMeters: data.distanceMeters,
          status: calc.status,
          ...(data.eventType === "CHECK_IN" ? { checkInUtc: timestampUtc } : {}),
          ...(data.eventType === "CHECK_OUT" ? { checkOutUtc: timestampUtc } : {})
        },
        create: {
          employeeId: emp.id,
          workDate: workDateIso,
          checkInUtc: data.eventType === "CHECK_IN" ? timestampUtc : null,
          checkOutUtc: data.eventType === "CHECK_OUT" ? timestampUtc : null,
          inMin: nextInMin,
          outMin: nextOutMin,
          workedMin: calc.workedMin,
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          hourlyLeaveMin: approvedHourlyMin,
          distanceMeters: data.distanceMeters,
          status: calc.status
        }
      });

      return { accessLog: createdLog, updatedEmp: empAfter };
    });

    const dtoAccess = {
      id: accessLog.id,
      empId: emp.id,
      sicil: emp.sicil,
      name: emp.name,
      dept: emp.dept,
      branch: accessLog.branchCode,
      eventType: accessLog.eventType,
      eventLabel: EVENT_LABELS[accessLog.eventType] || accessLog.eventType,
      source: accessLog.source,
      distanceMeters: accessLog.distanceMeters,
      accuracyMeters: accessLog.accuracyMeters,
      isMockGps: accessLog.isMockGps,
      nearbyWifis,
      matchedBssid: accessLog.matchedBssid,
      wifiStatus: accessLog.wifiStatus,
      note: accessLog.note,
      timestampUtc: accessLog.timestampUtc.toISOString(),
      timeIstanbul: toIstanbulTime(accessLog.timestampUtc),
      dateIstanbul: toIstanbulDate(accessLog.timestampUtc)
    };

    sseHub.broadcast({
      type: "ACCESS_LOG",
      title: `${EVENT_LABELS[data.eventType] || data.eventType}`,
      message: `${emp.name} (${emp.sicil}) · Saat ${dtoAccess.timeIstanbul} (${data.distanceMeters.toFixed(
        1
      )}m)`,
      severity: updatedEmp.status === "LATE" && data.eventType === "CHECK_IN" ? "warn" : "ok",
      data: {
        accessLog: dtoAccess,
        employee: {
          id: updatedEmp.id,
          sicil: updatedEmp.sicil,
          status: updatedEmp.status,
          inMin: updatedEmp.inMin,
          outMin: updatedEmp.outMin,
          checkIn: updatedEmp.checkIn,
          checkOut: updatedEmp.checkOut,
          lateMin: updatedEmp.lateMin,
          overtimeMin: updatedEmp.overtimeMin,
          dist: updatedEmp.distMeters
        }
      }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${emp.name} için ${EVENT_LABELS[data.eventType]} kaydedildi.`,
        accessLog: dtoAccess,
        attendance: {
          status: updatedEmp.status,
          checkIn: updatedEmp.checkIn,
          checkOut: updatedEmp.checkOut,
          lateMin: updatedEmp.lateMin,
          overtimeMin: updatedEmp.overtimeMin
        }
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Geçiş hareketi kaydedilemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
