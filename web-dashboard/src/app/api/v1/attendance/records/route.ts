import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDailyLogsForEmployee } from "@/lib/pdks-engine";
import { resolveMobileEmployee } from "@/lib/mobile-compat";
import { toIstanbulDate, toIstanbulTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function parseDmyAndTimeToMillis(dateDmy: string, timeHhmm: string): number {
  const [dd, mm, yyyy] = dateDmy.split(".").map(Number);
  const [hh, min] = timeHhmm.split(":").map(Number);
  if (!dd || !mm || !yyyy) return Date.now();
  // Europe/Istanbul GMT+3 -> UTC saat = hh - 3
  return Date.UTC(yyyy, mm - 1, dd, (hh || 8) - 3, min || 30, 0);
}

/**
 * Mobil Android Uygulaması Personel Geçmiş Kayıtları Uyum Katmanı:
 * GET /api/v1/attendance/records?employee_id=501 (veya employeeId / sicil)
 * Yanıt: List<AttendanceRecordDto> (JSON dizi)
 * PostgreSQL'deki gerçek AccessLog kayıtlarını ve deterministik 30 günlük puantaj geçmişini birleştirir.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empParam =
      searchParams.get("employee_id") ||
      searchParams.get("employeeId") ||
      searchParams.get("sicil") ||
      "501";

    const emp = await resolveMobileEmployee({
      employeeId: /^\d+$/.test(empParam) ? Number(empParam) : null,
      employeeCode: empParam
    });

    if (!emp) {
      return NextResponse.json([]);
    }

    const branch = emp.branch;
    const branchMatch = String(emp.branchCode || "").match(/(\d+)$/);
    const branchId = branchMatch ? Math.max(1, Number(branchMatch[1])) : (branch?.id ?? 1);
    const branchName = branch?.name || "Albayrak Finans Genel Müdürlük (Ataşehir)";
    const branchLat = branch?.lat ?? 40.995454;
    const branchLng = branch?.lng ?? 29.140893;

    // 1. PostgreSQL access_logs tablosundaki gerçek kayıtlar
    const realLogs = await prisma.accessLog.findMany({
      where: { employeeId: emp.id },
      orderBy: { timestampUtc: "desc" },
      take: 60
    });

    const shiftStart = emp.shift?.startMin ?? 510;
    const shiftGrace = emp.shift?.graceMin ?? 5;
    const shiftEnd = emp.shift?.endMin ?? 1050;

    const out: Array<Record<string, unknown>> = [];
    const coveredDates = new Set<string>();

    for (const log of realLogs) {
      const isOut = log.eventType === "CHECK_OUT" || log.eventType.endsWith("_OUT");
      const recType = isOut ? "ÇIKIŞ" : "GİRİŞ";
      const timeStr = toIstanbulTime(log.timestampUtc);
      const dateStr = toIstanbulDate(log.timestampUtc);
      const [h, m] = timeStr.split(":").map(Number);
      const totalMin = (h || 0) * 60 + (m || 0);

      const lateMinutes =
        !isOut && totalMin > shiftStart + shiftGrace
          ? totalMin - (shiftStart + shiftGrace)
          : 0;
      const overtimeMinutes =
        isOut && totalMin > shiftEnd ? totalMin - shiftEnd : 0;

      let nearbyWifis: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(log.nearbyWifisJson || "[]");
        if (Array.isArray(parsed)) nearbyWifis = parsed;
      } catch {
        nearbyWifis = [];
      }

      coveredDates.add(`${dateStr}_${recType}`);
      out.push({
        id: log.id,
        employeeId: emp.id,
        employeeName: emp.name,
        branchId,
        branchName,
        recordType: recType,
        timestamp: log.timestampUtc.getTime(),
        formattedTime: timeStr,
        formattedDate: dateStr,
        userLatitude: branchLat,
        userLongitude: branchLng,
        distanceMeters: log.distanceMeters,
        accuracyMeters: log.accuracyMeters,
        isWithin5Meters: log.distanceMeters <= (branch?.radiusMeters ?? 30.0),
        ipAddress: "10.14.88.19",
        deviceModel: emp.deviceModel || "Albayrak Kurumsal Cihaz",
        isMockLocation: log.isMockGps,
        nearbyWifis,
        note: log.note || (recType === "GİRİŞ" ? "Mobil şube girişi" : "Mobil şube çıkışı"),
        lateMinutes,
        overtimeMinutes
      });
    }

    // 2. Web panelindeki (pdks-engine) deterministik 30 iş günü geçmişiyle tamamla
    const dailyLogs = buildDailyLogsForEmployee({
      id: emp.id,
      sicil: emp.sicil,
      status: emp.status,
      inMin: emp.inMin,
      outMin: emp.outMin,
      lateMin: emp.lateMin,
      overtimeMin: emp.overtimeMin,
      distMeters: emp.distMeters,
      shiftStartMin: shiftStart,
      shiftEndMin: shiftEnd
    }).slice(-30);

    let syntheticId = 900_000 + emp.id * 100;
    for (const d of dailyLogs) {
      if (d.status !== "PRESENT" && d.status !== "LATE") continue;

      if (d.checkIn && !coveredDates.has(`${d.fullDate}_GİRİŞ`)) {
        const tsIn = parseDmyAndTimeToMillis(d.fullDate, d.checkIn);
        out.push({
          id: syntheticId++,
          employeeId: emp.id,
          employeeName: emp.name,
          branchId,
          branchName,
          recordType: "GİRİŞ",
          timestamp: tsIn,
          formattedTime: d.checkIn,
          formattedDate: d.fullDate,
          userLatitude: branchLat,
          userLongitude: branchLng,
          distanceMeters: d.dist,
          accuracyMeters: 3.4521,
          isWithin5Meters: d.dist <= 30.0,
          ipAddress: "10.14.88.19",
          deviceModel: emp.deviceModel || "Albayrak Kurumsal Cihaz",
          isMockLocation: false,
          nearbyWifis: [],
          note:
            d.lateMin > 0
              ? `${d.lateMin} dk gecikmeli giriş`
              : "Zamanında şube içi giriş",
          lateMinutes: d.lateMin,
          overtimeMinutes: 0
        });
      }

      if (d.checkOut && !coveredDates.has(`${d.fullDate}_ÇIKIŞ`)) {
        const tsOut = parseDmyAndTimeToMillis(d.fullDate, d.checkOut);
        out.push({
          id: syntheticId++,
          employeeId: emp.id,
          employeeName: emp.name,
          branchId,
          branchName,
          recordType: "ÇIKIŞ",
          timestamp: tsOut,
          formattedTime: d.checkOut,
          formattedDate: d.fullDate,
          userLatitude: branchLat,
          userLongitude: branchLng,
          distanceMeters: d.dist,
          accuracyMeters: 3.4521,
          isWithin5Meters: d.dist <= 30.0,
          ipAddress: "10.14.88.19",
          deviceModel: emp.deviceModel || "Albayrak Kurumsal Cihaz",
          isMockLocation: false,
          nearbyWifis: [],
          note:
            d.overtimeMin > 0
              ? `+${d.overtimeMin} dk onaylı ek mesai`
              : "Normal mesai çıkışı",
          lateMinutes: 0,
          overtimeMinutes: d.overtimeMin
        });
      }
    }

    out.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel devam kayıtları alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}
