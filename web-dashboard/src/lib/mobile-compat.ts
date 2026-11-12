import { prisma } from "@/lib/prisma";
import {
  isSuspiciousGpsAccuracy,
  normalizeBssid,
  parseBssidList
} from "@/lib/validators";
import { calculateAttendanceMetrics, hhmmFromMin, minFromHhmm } from "@/lib/pdks-engine";
import { toIstanbulDate, toIstanbulTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";
import { haversineMeters, isValidCoord } from "@/lib/geo";

/** Cihaz saatinin sunucu saatinden ileri olabileceği azami sapma. */
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
/** Bu süreden geç eşitlenen kayıtlar İK için not ile işaretlenir. */
const LATE_SYNC_FLAG_MS = 10 * 60 * 1000;

export interface IngestOptions {
  broadcastSse?: boolean;
  /**
   * JWT'den gelen personel sicili. Verildiğinde istek gövdesindeki
   * employeeId / employeeCode / employeeName alanları yok sayılır
   * (personel başkası adına kayıt gönderemez).
   */
  boundSicil?: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  CHECK_IN: "Sabah Giriş (Check-In)",
  LUNCH_OUT: "Öğle Arası Çıkış",
  LUNCH_IN: "Öğle Arası Dönüş",
  BREAK_OUT: "Kısa Mola Çıkışı",
  BREAK_IN: "Kısa Mola Dönüşü",
  CHECK_OUT: "Akşam Çıkış (Check-Out)"
};

export interface MobileRecordInput {
  id?: number | null;
  employeeId?: number | null;
  employee_id?: number | null;
  employeeCode?: string | null;
  employee_code?: string | null;
  sicil?: string | null;
  employeeName?: string | null;
  employee_name?: string | null;
  branchId?: number | null;
  branch_id?: number | null;
  branchCode?: string | null;
  branch_code?: string | null;
  branchName?: string | null;
  branch_name?: string | null;
  recordType?: string | null;
  record_type?: string | null;
  eventType?: string | null;
  timestamp?: number | null;
  formattedTime?: string | null;
  formattedDate?: string | null;
  userLatitude?: number | null;
  userLongitude?: number | null;
  distanceMeters?: number | null;
  distance_meters?: number | null;
  distance_to_branch?: number | null;
  accuracyMeters?: number | null;
  accuracy_meters?: number | null;
  isWithin5Meters?: boolean | null;
  isMockLocation?: boolean | null;
  isMockGps?: boolean | null;
  is_mock?: boolean | null;
  nearbyWifis?: Array<{
    bssid?: string;
    ssid?: string;
    rssi?: number;
    frequency?: number;
  }>;
  nearby_wifis?: Array<{
    bssid?: string;
    ssid?: string;
    rssi?: number;
    frequency?: number;
  }>;
  deviceModel?: string | null;
  device_model?: string | null;
  note?: string | null;
  lateMinutes?: number | null;
  overtimeMinutes?: number | null;
  lateReasonCode?: string | null;
  late_reason_code?: string | null;
  lateReasonNote?: string | null;
  late_reason_note?: string | null;
}

export interface MobileAlertInput {
  timestamp?: number | null;
  employeeId?: number | null;
  employee_id?: number | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  employee_name?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  branch_name?: string | null;
  alertType?: string | null;
  alert_type?: string | null;
  message?: string | null;
  distanceMeters?: number | null;
  distance_meters?: number | null;
  severity?: string | null;
}

export function normalizeMobileEventType(raw?: string | null): string {
  const s = String(raw || "GİRİŞ").trim().toUpperCase();
  if (
    s.includes("ÇIKIŞ") ||
    s.includes("CIKIS") ||
    s === "CHECK_OUT" ||
    s === "OUT"
  ) {
    return "CHECK_OUT";
  }
  if (s.includes("OGLE_CIKIS") || s === "LUNCH_OUT") return "LUNCH_OUT";
  if (s.includes("OGLE_DONUS") || s === "LUNCH_IN") return "LUNCH_IN";
  if (s === "BREAK_OUT") return "BREAK_OUT";
  if (s === "BREAK_IN") return "BREAK_IN";
  return "CHECK_IN";
}

export function normalizeMobileAlertType(raw?: string | null): string {
  const s = String(raw || "").trim().toUpperCase();
  if (s.includes("MOCK") || s.includes("SAHTE")) return "Sahte GPS (Mock)";
  if (s.includes("WIFI") || s.includes("BSSID")) return "Kurumsal Wi-Fi dışı";
  if (s.includes("DEVICE") || s.includes("CIHAZ")) return "Farklı cihaz";
  if (s.includes("MESAI")) return "Mesai dışı giriş";
  return "30m sınır aşımı";
}

export async function resolveMobileEmployee(input: {
  employeeId?: number | null;
  employeeCode?: string | null;
  employeeName?: string | null;
}) {
  const rawCode = String(input.employeeCode || "").trim().toUpperCase();
  const rawName = String(input.employeeName || "").trim();
  const rawId = Number(input.employeeId || 0);

  if (rawCode) {
    const byCode = await prisma.employee.findFirst({
      where: { sicil: { equals: rawCode, mode: "insensitive" } },
      include: { shift: true, branch: true }
    });
    if (byCode) return byCode;
  }

  if (Number.isInteger(rawId) && rawId > 0) {
    const byId = await prisma.employee.findUnique({
      where: { id: rawId },
      include: { shift: true, branch: true }
    });
    if (byId) return byId;

    // Mobil eski ID (1..500) gönderdiyse FN-(1000+id) ile eşleştir
    if (rawId <= 500) {
      const fallbackSicil = `FN-${1000 + rawId}`;
      const byFallbackSicil = await prisma.employee.findUnique({
        where: { sicil: fallbackSicil },
        include: { shift: true, branch: true }
      });
      if (byFallbackSicil) return byFallbackSicil;
    }
  }

  if (rawName) {
    const byName = await prisma.employee.findFirst({
      where: { name: { equals: rawName, mode: "insensitive" } },
      include: { shift: true, branch: true }
    });
    if (byName) return byName;
  }

  return null;
}

export async function resolveMobileBranch(
  input: {
    branchCode?: string | null;
    branchId?: number | null;
    branchName?: string | null;
  },
  fallbackCode = "ŞB-001"
) {
  const rawCode = String(input.branchCode || "").trim().toUpperCase();
  if (rawCode) {
    const b = await prisma.branch.findUnique({ where: { code: rawCode } });
    if (b) return b;
  }

  const bId = Number(input.branchId || 0);
  if (Number.isInteger(bId) && bId > 0) {
    const byId = await prisma.branch.findUnique({ where: { id: bId } });
    if (byId) return byId;
    const codeFromId = `ŞB-${String(bId).padStart(3, "0")}`;
    const byCode = await prisma.branch.findUnique({ where: { code: codeFromId } });
    if (byCode) return byCode;
  }

  const rawName = String(input.branchName || "").trim();
  if (rawName) {
    const byName = await prisma.branch.findFirst({
      where: { name: { equals: rawName, mode: "insensitive" } }
    });
    if (byName) return byName;
  }

  return (
    (await prisma.branch.findUnique({ where: { code: fallbackCode } })) ??
    (await prisma.branch.findFirst({ orderBy: { id: "asc" } }))
  );
}

export async function ingestMobileAttendanceRecord(
  raw: MobileRecordInput,
  opts?: IngestOptions
) {
  const broadcastSse = opts?.broadcastSse ?? true;
  const emp = opts?.boundSicil
    ? await resolveMobileEmployee({ employeeCode: opts.boundSicil })
    : await resolveMobileEmployee({
        employeeId: raw.employeeId ?? raw.employee_id,
        employeeCode: raw.employeeCode ?? raw.employee_code ?? raw.sicil,
        employeeName: raw.employeeName ?? raw.employee_name
      });

  if (!emp) {
    return { status: "skipped" as const, reason: "Personel bulunamadı." };
  }

  const branch = await resolveMobileBranch(
    {
      branchCode: raw.branchCode ?? raw.branch_code,
      branchId: raw.branchId ?? raw.branch_id,
      branchName: raw.branchName ?? raw.branch_name
    },
    emp.branchCode
  );
  const targetBranchCode = branch?.code || emp.branchCode || "ŞB-001";
  const allowedRadius = branch?.radiusMeters ?? 30.0;

  const eventType = normalizeMobileEventType(
    raw.eventType ?? raw.recordType ?? raw.record_type
  );
  // Mesafe istemcinin bildirdiği değerden DEĞİL, sunucuda gelen koordinat ile
  // şube merkezi arasında Haversine ile hesaplanır. Koordinat yoksa işlem reddedilir.
  const userLat = Number(raw.userLatitude);
  const userLng = Number(raw.userLongitude);
  const hasUserCoords = isValidCoord(userLat, userLng);
  const hasBranchCoords = Boolean(branch) && isValidCoord(branch?.lat, branch?.lng);
  const isMissingLocation = !hasUserCoords || !hasBranchCoords;
  const distanceMeters =
    !isMissingLocation && branch
      ? Number(haversineMeters(userLat, userLng, branch.lat, branch.lng).toFixed(2))
      : 0;
  const hasExplicitAccuracy =
    raw.accuracyMeters != null || raw.accuracy_meters != null;
  const rawAccuracy = Number(raw.accuracyMeters ?? raw.accuracy_meters ?? 3.4521);
  const isFakeAccuracy =
    hasExplicitAccuracy && isSuspiciousGpsAccuracy(rawAccuracy);
  const effectiveAccuracy =
    Number.isFinite(rawAccuracy) && !isFakeAccuracy
      ? rawAccuracy
      : Number((3.4521 + ((emp.id * 13) % 37) * 0.0713).toFixed(4));

  const isMockFlag = Boolean(
    raw.isMockLocation ?? raw.isMockGps ?? raw.is_mock ?? false
  );
  const isOutOfGeofence =
    isMissingLocation || raw.isWithin5Meters === false || distanceMeters > allowedRadius;

  const rawWifis = Array.isArray(raw.nearbyWifis)
    ? raw.nearbyWifis
    : Array.isArray(raw.nearby_wifis)
    ? raw.nearby_wifis
    : [];
  const nearbyWifis = rawWifis
    .map((w) => ({
      bssid: normalizeBssid(w.bssid),
      ssid: w.ssid || "",
      rssi: typeof w.rssi === "number" ? w.rssi : -62
    }))
    .filter((w) => Boolean(w.bssid));

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
      wifiStatus =
        branchEnforcement === "STRICT" ? "BLOCKED_BSSID" : "UNVERIFIED_LOGGED";
    } else {
      wifiStatus = "LEARNING";
    }
  }

  const isStrictWifiMismatch =
    branchEnforcement === "STRICT" &&
    Boolean(primaryBssid || backupBssids.length > 0) &&
    !matchedBssid;

  // Zaman damgası: cihaz saati ileri alınmışsa sunucu saatine kırpılır;
  // geç eşitlenen (çevrimdışı) kayıtlar İK'nın görmesi için not ile işaretlenir.
  const now = new Date();
  const clientTs =
    raw.timestamp && Number.isFinite(raw.timestamp) && raw.timestamp > 1_000_000_000_000
      ? Number(raw.timestamp)
      : null;
  const timestampUtc = clientTs ? new Date(Math.min(clientTs, now.getTime())) : now;
  let clockNote: string | null = null;
  if (clientTs && clientTs - now.getTime() > MAX_FUTURE_SKEW_MS) {
    clockNote = "Cihaz saati sunucudan ileri; sunucu saati esas alındı";
  } else if (clientTs && now.getTime() - clientTs > LATE_SYNC_FLAG_MS) {
    clockNote = `Gecikmeli eşitleme (+${Math.round((now.getTime() - clientTs) / 60000)} dk)`;
  }

  // Çok eski demo seed kayıtlarını (bugünden 1 günden eski) sync sırasında canlı akışı kirletmemesi için kontrol et
  const ageMs = Math.abs(now.getTime() - timestampUtc.getTime());
  const isTodayRecord = toIstanbulDate(timestampUtc) === toIstanbulDate(now);

  // Eğer sahte konum, sahte accuracy, 30m sınır aşımı veya STRICT Wi-Fi ihlali varsa güvenlik alarmı oluştur
  if (isMockFlag || isFakeAccuracy || isOutOfGeofence || isStrictWifiMismatch) {
    let alertType = "30m sınır aşımı";
    let blockReason = `${distanceMeters.toFixed(1)}m (${targetBranchCode})`;
    if (isMissingLocation && !isMockFlag) {
      alertType = "Konum doğrulanamadı";
      blockReason = "Cihaz koordinatı gönderilmedi veya geçersiz; mesafe sunucuda hesaplanamadı.";
    } else if (isMockFlag) {
      alertType = "Sahte GPS (Mock)";
      blockReason = "Sahte konum / Geliştirici Seçenekleri hilesi yakalandı.";
    } else if (isFakeAccuracy) {
      alertType = "Sahte GPS (Sabit Accuracy)";
      blockReason = `Yapay GPS sapma değeri tespit edildi (${rawAccuracy.toFixed(5)} m).`;
    } else if (isStrictWifiMismatch) {
      alertType = "Kurumsal Wi-Fi dışı";
      blockReason = `Şube BSSID (${primaryBssid || backupBssids[0]}) etraftaki Wi-Fi taramasında görülmedi.`;
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
        distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 52.0,
        status: "OPEN"
      }
    });

    if (broadcastSse) {
      sseHub.broadcast({
        type: "SECURITY_ALERT",
        title: `Mobil Güvenlik İhlali: ${alertType}`,
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
          dist: distanceMeters,
          status: "OPEN"
        }
      });
    }

    return {
      status: "blocked" as const,
      alertCode: alert.code,
      message: `${alertType}: ${blockReason} İşlem engellendi ve BT Güvenlik Radarına işlendi.`
    };
  }

  // Aynı saniyede mükerrer AccessLog oluşmasını önle (batch sync idempotency)
  const minWindow = new Date(timestampUtc.getTime() - 45_000);
  const maxWindow = new Date(timestampUtc.getTime() + 45_000);
  const duplicate = await prisma.accessLog.findFirst({
    where: {
      employeeId: emp.id,
      eventType,
      timestampUtc: { gte: minWindow, lte: maxWindow }
    }
  });

  const lateReasonCode =
    String(raw.lateReasonCode ?? raw.late_reason_code ?? "").trim() || null;
  const lateReasonNote =
    String(raw.lateReasonNote ?? raw.late_reason_note ?? "").trim() || null;

  const workDateIstanbul = toIstanbulDate(timestampUtc); // DD.MM.YYYY
  const [dd, mm, yyyy] = workDateIstanbul.split(".");
  const workDateIso =
    dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : timestampUtc.toISOString().slice(0, 10);

  if (duplicate) {
    // Eğer bu kayıt için sonradan geç kalma gerekçesi gönderildiyse DailyAttendance üzerinde güncelle
    if (lateReasonCode) {
      const updatedDaily = await prisma.dailyAttendance.updateMany({
        where: { employeeId: emp.id, workDate: workDateIso },
        data: {
          lateReasonCode,
          lateReasonNote: lateReasonNote || "",
          lateExcuseStatus: "PENDING"
        }
      });
      if (updatedDaily.count > 0 && broadcastSse) {
        sseHub.broadcast({
          type: "LATE_REASON_UPDATE",
          title: "Mobil Geç Giriş Gerekçesi Bildirildi",
          message: `${emp.name} (${emp.sicil}) · Gerekçe: ${lateReasonCode}${
            lateReasonNote ? ` (${lateReasonNote})` : ""
          }`,
          severity: "warn",
          data: {
            employeeId: emp.id,
            sicil: emp.sicil,
            workDate: workDateIso,
            reasonCode: lateReasonCode,
            reasonNote: lateReasonNote
          }
        });
      }
    }
    return {
      status: "duplicate" as const,
      accessLogId: duplicate.id
    };
  }

  // Eğer batch sync ile geçmiş günlerin örnek kayıtları geliyorsa (24 saatten eski),
  // canlı bugünkü durumu bozmamak için yalnızca bugünkü veya son 18 saatlik gerçek hareketleri işle
  if (!isTodayRecord && ageMs > 18 * 3600 * 1000 && opts?.broadcastSse === false) {
    return { status: "skipped_old" as const };
  }

  // Giriş/çıkış dakikası istemcinin gönderdiği "formattedTime" metninden değil,
  // doğrulanmış zaman damgasından türetilir.
  const clockMin = minFromHhmm(toIstanbulTime(timestampUtc)) ?? 8 * 60 + 30;

  const deviceModel = String(
    raw.deviceModel ?? raw.device_model ?? emp.deviceModel ?? "Android Mobil İstemci"
  ).trim();

  const baseNote =
    raw.note && String(raw.note).trim()
      ? String(raw.note).trim().slice(0, 300)
      : `${EVENT_LABELS[eventType] || eventType} · Mobil (${deviceModel})`;
  const noteText = clockNote ? `${baseNote} · ${clockNote}` : baseNote;

  const { accessLog, updatedEmp, dailyRecord } = await prisma.$transaction(async (tx) => {
    const createdLog = await tx.accessLog.create({
      data: {
        employeeId: emp.id,
        eventType,
        source: "MOBILE_GEOFENCE",
        branchCode: targetBranchCode,
        distanceMeters,
        accuracyMeters: effectiveAccuracy,
        isMockGps: false,
        nearbyWifisJson: JSON.stringify(nearbyWifis),
        matchedBssid,
        wifiStatus,
        note: noteText,
        timestampUtc
      }
    });

    let nextInMin = emp.inMin;
    let nextOutMin = emp.outMin;

    // Mobil cihazdan anlık giriş/çıkış yapıldığında saat doğrudan güncellenir
    if (eventType === "CHECK_IN") {
      nextInMin = clockMin;
    } else if (eventType === "CHECK_OUT") {
      nextOutMin = clockMin;
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
        distMeters: distanceMeters,
        ...(deviceModel ? { deviceModel } : {})
      },
      include: { shift: true }
    });

    const daily = await tx.dailyAttendance.upsert({
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
        distanceMeters,
        status: calc.status,
        ...(eventType === "CHECK_IN" ? { checkInUtc: timestampUtc } : {}),
        ...(eventType === "CHECK_OUT" ? { checkOutUtc: timestampUtc } : {}),
        ...(lateReasonCode
          ? {
              lateReasonCode,
              lateReasonNote: lateReasonNote || "",
              lateExcuseStatus: "PENDING"
            }
          : {})
      },
      create: {
        employeeId: emp.id,
        workDate: workDateIso,
        checkInUtc: eventType === "CHECK_IN" ? timestampUtc : null,
        checkOutUtc: eventType === "CHECK_OUT" ? timestampUtc : null,
        inMin: nextInMin,
        outMin: nextOutMin,
        workedMin: calc.workedMin,
        lateMin: calc.lateMin,
        overtimeMin: calc.overtimeMin,
        hourlyLeaveMin: approvedHourlyMin,
        distanceMeters,
        status: calc.status,
        ...(lateReasonCode
          ? {
              lateReasonCode,
              lateReasonNote: lateReasonNote || "",
              lateExcuseStatus: "PENDING"
            }
          : {})
      }
    });

    return { accessLog: createdLog, updatedEmp: empAfter, dailyRecord: daily };
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

  if (broadcastSse) {
    sseHub.broadcast({
      type: "ACCESS_LOG",
      title: `${EVENT_LABELS[eventType] || eventType} (Mobil)`,
      message: `${emp.name} (${emp.sicil}) · Saat ${dtoAccess.timeIstanbul} (${distanceMeters.toFixed(
        1
      )}m)`,
      severity:
        updatedEmp.status === "LATE" && eventType === "CHECK_IN" ? "warn" : "ok",
      data: {
        accessLog: dtoAccess,
        dailyAttendanceId: dailyRecord.id,
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
  }

  return {
    status: "created" as const,
    accessLog: dtoAccess,
    employee: updatedEmp
  };
}

export async function ingestMobileSecurityAlert(
  raw: MobileAlertInput,
  opts?: IngestOptions
) {
  const broadcastSse = opts?.broadcastSse ?? true;
  const emp = opts?.boundSicil
    ? await resolveMobileEmployee({ employeeCode: opts.boundSicil })
    : await resolveMobileEmployee({
        employeeId: raw.employeeId ?? raw.employee_id,
        employeeCode: raw.employeeCode,
        employeeName: raw.employeeName ?? raw.employee_name
      });
  if (!emp) return null;

  const branch = await resolveMobileBranch(
    {
      branchCode: raw.branchCode,
      branchName: raw.branchName ?? raw.branch_name
    },
    emp.branchCode
  );
  const branchCode = branch?.code || emp.branchCode || "ŞB-001";
  const alertType = normalizeMobileAlertType(raw.alertType ?? raw.alert_type);
  const distanceMeters = Number(
    raw.distanceMeters ?? raw.distance_meters ?? 48.5
  );
  const severity =
    String(raw.severity || "HIGH").toUpperCase() === "HIGH" ? "HIGH" : "MED";

  const recentSimilar = await prisma.securityAlert.findFirst({
    where: {
      employeeId: emp.id,
      alertType,
      createdAtUtc: { gte: new Date(Date.now() - 60_000) }
    }
  });
  if (recentSimilar) return recentSimilar;

  const alertCode = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const created = await prisma.securityAlert.create({
    data: {
      code: alertCode,
      employeeId: emp.id,
      branchCode,
      alertType,
      severity,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 48.5,
      status: "OPEN"
    }
  });

  if (broadcastSse) {
    sseHub.broadcast({
      type: "SECURITY_ALERT",
      title: `Mobil Güvenlik Alarmı: ${alertType}`,
      message: `${emp.name} (${emp.sicil}) · ${
        raw.message || `${distanceMeters.toFixed(1)}m mesafe ihlali`
      }`,
      severity: "bad",
      data: {
        id: created.code,
        empId: emp.id,
        sicil: emp.sicil,
        name: emp.name,
        dept: emp.dept,
        branch: branchCode,
        type: alertType,
        sev: severity,
        dist: distanceMeters,
        status: "OPEN"
      }
    });
  }

  return created;
}
