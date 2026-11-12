import { NextRequest, NextResponse } from "next/server";
import { errorDetail, HR_APPROVER_ROLES, requireUser, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { LeaveDecisionSchema, LeaveRequestCreateSchema } from "@/lib/validators";
import { calculateAttendanceMetrics, minFromHhmm } from "@/lib/pdks-engine";
import { toIstanbulDateTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireUser(req, STAFF_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const where = status !== "ALL" ? { status } : {};

    const rows = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
        }
      },
      orderBy: { id: "desc" },
      take: 250
    });

    return NextResponse.json({
      status: "success",
      count: rows.length,
      leaves: rows.map((l) => ({
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
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "İzin talepleri alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req, HR_APPROVER_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const parsed = LeaveRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz izin talebi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) {
      return NextResponse.json(
        { status: "error", message: "Personel bulunamadı." },
        { status: 404 }
      );
    }

    const isHourly = data.leaveType === "Saatlik izin" || data.isHourly;
    let durationMin = Math.round(data.days * 480);
    let days = data.days;

    if (isHourly && data.startClock && data.endClock) {
      const sMin = minFromHhmm(data.startClock) ?? 510;
      const eMin = minFromHhmm(data.endClock) ?? 630;
      durationMin = Math.max(15, eMin - sMin);
      days = +(durationMin / 480).toFixed(2);
    }

    const latestLeave = await prisma.leaveRequest.findFirst({
      orderBy: { id: "desc" },
      select: { id: true }
    });
    const code = `TL-${2450 + (latestLeave?.id ?? 0) + 1}`;

    const created = await prisma.leaveRequest.create({
      data: {
        code,
        employeeId: emp.id,
        leaveType: data.leaveType,
        isHourly,
        startDate: data.startDate,
        endDate: isHourly ? data.startDate : data.endDate,
        startClock: isHourly ? data.startClock : null,
        endClock: isHourly ? data.endClock : null,
        days,
        durationMin,
        note: data.note,
        status: "PENDING"
      },
      include: {
        employee: {
          select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
        }
      }
    });

    const dto = {
      id: created.code,
      dbId: created.id,
      empId: created.employeeId,
      sicil: created.employee.sicil,
      name: created.employee.name,
      dept: created.employee.dept,
      branch: created.employee.branchCode,
      type: created.leaveType,
      isHourly: created.isHourly,
      start: created.startDate,
      end: created.endDate,
      startClock: created.startClock,
      endClock: created.endClock,
      days: created.days,
      durationMin: created.durationMin,
      note: created.note,
      status: created.status
    };

    sseHub.broadcast({
      type: "LEAVE_UPDATE",
      title: `Yeni ${isHourly ? "Saatlik İzin" : "İzin"} Talebi`,
      message: `${emp.name} (${emp.sicil}) · ${created.leaveType} (${
        isHourly ? `${created.startClock}-${created.endClock}` : `${created.days} gün`
      })`,
      severity: "info",
      data: { action: "CREATE", leave: dto }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${created.code} numaralı izin talebi oluşturuldu.`,
        leave: dto
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "İzin talebi oluşturulamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireUser(req, HR_APPROVER_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const code = String(body.code || body.id || "").trim();
    const parsed = LeaveDecisionSchema.safeParse(body);
    if (!code || !parsed.success) {
      return NextResponse.json(
        { status: "error", message: "Geçersiz izin onay/red bilgisi." },
        { status: 400 }
      );
    }

    const existing = await prisma.leaveRequest.findUnique({
      where: { code },
      include: {
        employee: { include: { shift: true } }
      }
    });

    if (!existing) {
      return NextResponse.json(
        { status: "error", message: `${code} numaralı talep bulunamadı.` },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const leaveAfter = await tx.leaveRequest.update({
        where: { code },
        data: {
          status: parsed.data.status,
          reviewerName: parsed.data.reviewerName || "Zehra Yılmaz (İK)",
          reviewedAtUtc: new Date()
        }
      });

      // Eğer onaylanan talep Saatlik İzin ise personelin gecikme süresinden düş!
      if (existing.isHourly && parsed.data.status === "APPROVED") {
        const emp = existing.employee;
        const calc = calculateAttendanceMetrics({
          inMin: emp.inMin,
          outMin: emp.outMin,
          shiftStartMin: emp.shift?.startMin ?? 510,
          shiftEndMin: emp.shift?.endMin ?? 1050,
          shiftGraceMin: emp.shift?.graceMin ?? 5,
          shiftBreakMin: emp.shift?.breakMin ?? 60,
          approvedHourlyLeaveMin: existing.durationMin
        });

        await tx.employee.update({
          where: { id: emp.id },
          data: {
            status: calc.status,
            lateMin: calc.lateMin
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorName: parsed.data.reviewerName || "İK Yönetimi",
          actorRole: "HR",
          action: `İzin talebi ${parsed.data.status === "APPROVED" ? "onaylandı" : "reddedildi"}`,
          target: `${existing.code} · ${existing.employee.name} (${existing.leaveType})`,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      });

      return leaveAfter;
    });

    sseHub.broadcast({
      type: "LEAVE_UPDATE",
      title: `İzin Talebi ${parsed.data.status === "APPROVED" ? "Onaylandı" : "Reddedildi"}`,
      message: `${existing.code} · ${existing.employee.name} (${existing.leaveType})`,
      severity: parsed.data.status === "APPROVED" ? "ok" : "warn",
      data: {
        action: "DECISION",
        code: existing.code,
        status: updated.status,
        empId: existing.employeeId,
        isHourly: existing.isHourly,
        durationMin: existing.durationMin
      }
    });

    return NextResponse.json({
      status: "success",
      message: `Talep ${existing.code} ${
        parsed.data.status === "APPROVED" ? "onaylandı" : "reddedildi"
      }.`,
      leave: {
        id: updated.code,
        status: updated.status,
        reviewerName: updated.reviewerName
      }
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "İzin durumu güncellenemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
