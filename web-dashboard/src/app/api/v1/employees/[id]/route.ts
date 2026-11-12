import { NextRequest, NextResponse } from "next/server";
import { errorDetail, HR_ROLES, requireUser, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { EmployeeUpdateSchema } from "@/lib/validators";
import { calculateAttendanceMetrics, hhmmFromMin, minFromHhmm } from "@/lib/pdks-engine";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

async function findEmployeeByIdentifier(identifier: string) {
  const trimmed = decodeURIComponent(identifier).trim();
  if (/^\d+$/.test(trimmed)) {
    return prisma.employee.findUnique({
      where: { id: Number(trimmed) },
      include: { shift: true }
    });
  }
  return prisma.employee.findUnique({
    where: { sicil: trimmed.toUpperCase() },
    include: { shift: true }
  });
}

function serializeEmployee(e: NonNullable<Awaited<ReturnType<typeof findEmployeeByIdentifier>>>) {
  return {
    id: e.id,
    sicil: e.sicil,
    name: e.name,
    dept: e.dept,
    title: e.title,
    branch: e.branchCode,
    radiusMeters: 30.0,
    shiftId: e.shiftId,
    shiftName: e.shift?.name || "Standart Kurumsal Mesai (08:30 – 17:30)",
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
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(req, STAFF_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await context.params;
    const emp = await findEmployeeByIdentifier(id);
    if (!emp) {
      return NextResponse.json(
        { status: "error", message: `${id} kodlu personel bulunamadı.` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      status: "success",
      employee: serializeEmployee(emp)
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel bilgisi alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

async function handleUpdate(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await findEmployeeByIdentifier(id);
    if (!existing) {
      return NextResponse.json(
        { status: "error", message: `${id} kodlu personel bulunamadı.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = EmployeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz güncelleme verisi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const nextStatus = data.status ?? existing.status;
    let inMin =
      data.checkIn !== undefined ? minFromHhmm(data.checkIn) : existing.inMin;
    let outMin =
      data.checkOut !== undefined ? minFromHhmm(data.checkOut) : existing.outMin;

    if (nextStatus === "LEAVE" || nextStatus === "ABSENT") {
      inMin = null;
      outMin = null;
    } else if (inMin == null) {
      inMin = nextStatus === "LATE" ? 535 : 506;
    }

    const calc = calculateAttendanceMetrics({
      inMin,
      outMin,
      shiftStartMin: existing.shift?.startMin ?? 510,
      shiftEndMin: existing.shift?.endMin ?? 1050,
      shiftGraceMin: 5,
      shiftBreakMin: 60
    });

    const updated = await prisma.employee.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? existing.name,
        dept: data.dept ?? existing.dept,
        title: data.title ?? existing.title,
        branchCode: data.branch ?? existing.branchCode,
        shiftId: data.shiftId ?? existing.shiftId,
        status: nextStatus,
        inMin,
        outMin,
        checkIn: hhmmFromMin(inMin),
        checkOut: hhmmFromMin(outMin),
        lateMin: nextStatus === "LEAVE" || nextStatus === "ABSENT" ? 0 : calc.lateMin,
        overtimeMin:
          nextStatus === "LEAVE" || nextStatus === "ABSENT" ? 0 : calc.overtimeMin,
        distMeters: data.dist ?? existing.distMeters,
        deviceModel: data.device ?? existing.deviceModel,
        deviceOs: data.os ?? existing.deviceOs,
        appVersion: data.ver ?? existing.appVersion,
        deviceBound: data.bound ?? existing.deviceBound,
        email: data.email ?? existing.email,
        hireDate: data.hireDate ?? existing.hireDate,
        leaveUsedDays: data.leaveUsed ?? existing.leaveUsedDays,
        leaveTotalDays: data.leaveTotal ?? existing.leaveTotalDays
      },
      include: { shift: true }
    });

    await prisma.auditLog.create({
      data: {
        actorName: "İK Yönetimi",
        actorRole: "HR",
        action: "Personel kartı güncellendi",
        target: `${updated.sicil} · ${updated.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    const dto = serializeEmployee(updated);
    sseHub.broadcast({
      type: "EMPLOYEE_CRUD",
      title: "Personel Güncellendi",
      message: `${updated.name} (${updated.sicil}) bilgileri güncellendi.`,
      severity: "info",
      data: { action: "UPDATE", employee: dto }
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.name} (${updated.sicil}) bilgileri güncellendi.`,
      employee: dto
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel güncellenemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(req, HR_ROLES);
  if (!guard.ok) return guard.response;
  return handleUpdate(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(req, HR_ROLES);
  if (!guard.ok) return guard.response;
  return handleUpdate(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(req, HR_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await context.params;
    const existing = await findEmployeeByIdentifier(id);
    if (!existing) {
      return NextResponse.json(
        { status: "error", message: `${id} kodlu personel bulunamadı.` },
        { status: 404 }
      );
    }

    await prisma.employee.delete({ where: { id: existing.id } });

    await prisma.auditLog.create({
      data: {
        actorName: "İK Yönetimi",
        actorRole: "HR",
        action: "Personel kaydı silindi",
        target: `${existing.sicil} · ${existing.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    const dto = serializeEmployee(existing);
    sseHub.broadcast({
      type: "EMPLOYEE_CRUD",
      title: "Personel Kaydı Silindi",
      message: `${existing.name} (${existing.sicil}) sistemden silindi.`,
      severity: "warn",
      data: { action: "DELETE", employee: dto }
    });

    return NextResponse.json({
      status: "success",
      message: `${existing.name} (${existing.sicil}) kaydı silindi.`,
      deleted: dto
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel silinemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
