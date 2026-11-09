import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toIstanbulDate, toIstanbulDateTime, toIstanbulTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      branches,
      shifts,
      employees,
      leaves,
      accessLogs,
      alerts,
      accounts,
      audits,
      accessLogTotal
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
      prisma.accessLog.count()
    ]);

    return NextResponse.json({
      status: "success",
      accessLogTotal,
      serverTimeUtc: new Date().toISOString(),
      serverTimeIstanbul: toIstanbulDateTime(new Date()),
      branches: branches.map((b) => ({
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
        w: b.weight
      })),
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
      accessLogs: accessLogs.map((a) => ({
        id: a.id,
        empId: a.employeeId,
        sicil: a.employee.sicil,
        name: a.employee.name,
        dept: a.employee.dept,
        branch: a.branchCode,
        eventType: a.eventType,
        source: a.source,
        distanceMeters: a.distanceMeters,
        isMockGps: a.isMockGps,
        note: a.note,
        timestampUtc: a.timestampUtc.toISOString(),
        timeIstanbul: toIstanbulTime(a.timestampUtc),
        dateIstanbul: toIstanbulDate(a.timestampUtc)
      })),
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
