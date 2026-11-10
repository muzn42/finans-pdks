import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBssidList } from "@/lib/validators";
import { toIstanbulDate, toIstanbulDateTime, toIstanbulTime, hhmmFromMin } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";
import { computeBranchWifiDiscovery } from "@/lib/wifi-discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const todayIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
    const [
      branches,
      shifts,
      employees,
      leaves,
      accessLogs,
      alerts,
      accounts,
      audits,
      accessLogTotal,
      lateReasons,
      todayExcuses,
      wifiDiscovery
    ] = await Promise.all([
      prisma.branch.findMany({ orderBy: { id: "asc" } }),
      prisma.shift.findMany({ orderBy: { id: "asc" } }),
      prisma.employee.findMany({
        include: { shift: true },
        orderBy: { id: "asc" },
        take: 1000
      }),
      prisma.leaveRequest.findMany({
        include: {
          employee: {
            select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
          }
        },
        orderBy: { id: "desc" },
        take: 250
      }),
      prisma.accessLog.findMany({
        include: {
          employee: {
            select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
          }
        },
        orderBy: { timestampUtc: "desc" },
        take: 120
      }),
      prisma.securityAlert.findMany({
        include: {
          employee: {
            select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
          }
        },
        orderBy: { id: "desc" },
        take: 60
      }),
      prisma.userAccount.findMany({ orderBy: { id: "asc" } }),
      prisma.auditLog.findMany({ orderBy: { createdAtUtc: "desc" }, take: 50 }),
      prisma.accessLog.count(),
      prisma.dailyAttendance.findMany({
        where: { lateReasonCode: { not: null } },
        include: {
          employee: { select: { id: true, sicil: true, name: true, dept: true, branchCode: true } }
        },
        orderBy: [{ workDate: "desc" }, { id: "desc" }],
        take: 150
      }),
      prisma.dailyAttendance.findMany({
        where: { workDate: todayIso, lateExcusedMin: { gt: 0 } },
        select: { employeeId: true, lateExcusedMin: true }
      }),
      computeBranchWifiDiscovery()
    ]);

    const todayExcuseMap = new Map<number, number>(
      todayExcuses.map((r) => [r.employeeId, r.lateExcusedMin])
    );

    return NextResponse.json({
      status: "success",
      accessLogTotal,
      serverTimeUtc: new Date().toISOString(),
      serverTimeIstanbul: toIstanbulDateTime(new Date()),
      branches: branches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        city: b.city,
        district: b.district,
        address: b.address,
        phone: b.phone,
        googleMapUrl: b.googleMapUrl,
        lat: b.lat,
        lng: b.lng,
        radius: b.radiusMeters,
        wifi: b.wifiSsid,
        wifiBssid: b.wifiBssid || "",
        backupWifiBssids: b.backupWifiBssids || "",
        backupBssidsList: parseBssidList(b.backupWifiBssids),
        wifiEnforcementMode: b.wifiEnforcementMode || "LEARNING",
        w: b.weight
      })),
      wifiDiscovery,
      shifts: shifts.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        startMin: s.startMin,
        endMin: s.endMin,
        breakMin: s.breakMin,
        graceMin: s.graceMin,
        isFlexible: s.isFlexible
      })),
      employees: employees.map((e) => ({
        id: e.id,
        sicil: e.sicil,
        name: e.name,
        dept: e.dept,
        title: e.title,
        branch: e.branchCode,
        shiftId: e.shiftId,
        shiftName: e.shift?.name || "Standart Mesai (08:30 – 17:30)",
        shiftStartMin: e.shift?.startMin ?? 510,
        shiftEndMin: e.shift?.endMin ?? 1050,
        status: e.status,
        inMin: e.inMin,
        outMin: e.outMin,
        checkIn: e.checkIn,
        checkOut: e.checkOut,
        lateMin: e.lateMin,
        // Bugünün gerekçeli düşümü, günlük puantaj kaydından okunur (dünkü düşüm sızmasın)
        lateExcusedMin: todayExcuseMap.get(e.id) ?? 0,
        overtimeMin: e.overtimeMin,
        dist: e.distMeters,
        device: e.deviceModel,
        os: e.deviceOs,
        ver: e.appVersion,
        bound: e.deviceBound,
        email: e.email,
        hireDate: e.hireDate,
        leaveUsed: e.leaveUsedDays,
        leaveTotal: e.leaveTotalDays
      })),
      leaves: leaves.map((l) => ({
        id: l.code,
        dbId: l.id,
        empId: l.employeeId,
        sicil: l.employee.sicil,
        name: l.employee.name,
        dept: l.employee.dept,
        branch: l.employee.branchCode,
        type: l.leaveType,
        isHourly: l.isHourly,
        start: l.startDate,
        end: l.endDate,
        startClock: l.startClock,
        endClock: l.endClock,
        days: l.days,
        durationMin: l.durationMin,
        note: l.note,
        status: l.status,
        reviewerName: l.reviewerName,
        createdAtIstanbul: toIstanbulDateTime(l.createdAtUtc)
      })),
      lateReasons: lateReasons.map((d) => ({
        id: d.id,
        empId: d.employeeId,
        sicil: d.employee.sicil,
        name: d.employee.name,
        dept: d.employee.dept,
        branch: d.employee.branchCode,
        workDate: d.workDate,
        checkIn: hhmmFromMin(d.inMin),
        lateMin: d.lateMin,
        reasonCode: d.lateReasonCode,
        reasonNote: d.lateReasonNote,
        status: d.lateExcuseStatus,
        excusedMin: d.lateExcusedMin,
        reviewedBy: d.lateReviewedBy,
        reviewedAt: d.lateReviewedAtUtc ? toIstanbulDateTime(d.lateReviewedAtUtc) : null
      })),
      accessLogs: accessLogs.map((a) => {
        let nearbyWifis: Array<{ bssid: string; ssid?: string; rssi?: number }> = [];
        try {
          const parsed = JSON.parse(a.nearbyWifisJson || "[]");
          if (Array.isArray(parsed)) nearbyWifis = parsed;
        } catch {
          nearbyWifis = [];
        }
        return {
          id: a.id,
          empId: a.employeeId,
          sicil: a.employee.sicil,
          name: a.employee.name,
          dept: a.employee.dept,
          branch: a.branchCode,
          eventType: a.eventType,
          source: a.source,
          distanceMeters: a.distanceMeters,
          accuracyMeters: a.accuracyMeters,
          isMockGps: a.isMockGps,
          nearbyWifis,
          matchedBssid: a.matchedBssid,
          wifiStatus: a.wifiStatus,
          note: a.note,
          timestampUtc: a.timestampUtc.toISOString(),
          timeIstanbul: toIstanbulTime(a.timestampUtc),
          dateIstanbul: toIstanbulDate(a.timestampUtc)
        };
      }),
      alerts: alerts.map((al) => ({
        id: al.code,
        dbId: al.id,
        empId: al.employeeId,
        sicil: al.employee.sicil,
        name: al.employee.name,
        dept: al.employee.dept,
        branch: al.branchCode,
        type: al.alertType,
        sev: al.severity,
        dist: al.distanceMeters,
        time: `${toIstanbulDate(al.createdAtUtc)} ${toIstanbulTime(al.createdAtUtc)}`,
        status: al.status
      })),
      accounts: accounts.map((acc) => {
        let perms: string[] = [];
        try {
          perms = JSON.parse(acc.permsJson);
        } catch {
          perms = [];
        }
        return {
          id: acc.code,
          email: acc.email,
          role: acc.role,
          name: acc.name,
          title: acc.title,
          branch: acc.branchCode,
          managedDept: acc.managedDept,
          employeeSicil: acc.employeeSicil,
          active: acc.active,
          perms
        };
      }),
      audits: audits.map((au) => ({
        time: toIstanbulTime(au.createdAtUtc),
        actor: au.actorName,
        role: au.actorRole,
        action: au.action,
        target: au.target,
        ip: au.ipAddress
      })),
      recentSseEvents: sseHub.getRecent()
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: "PostgreSQL veritabanı başlangıç verileri alınamadı.",
        detail: String(err)
      },
      { status: 500 }
    );
  }
}
