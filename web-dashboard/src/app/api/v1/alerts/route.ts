import { NextRequest, NextResponse } from "next/server";
import { errorDetail, IT_ROLES, requireUser, STAFF_ROLES } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { toIstanbulDate, toIstanbulTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireUser(req, STAFF_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const rows = await prisma.securityAlert.findMany({
      include: {
        employee: {
          select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
        }
      },
      orderBy: { id: "desc" },
      take: 60
    });

    return NextResponse.json({
      status: "success",
      count: rows.length,
      alerts: rows.map((al) => ({
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
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Güvenlik alarmları alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireUser(req, IT_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const code = String(body.code || body.id || "").trim();
    if (!code) {
      return NextResponse.json(
        { status: "error", message: "Alarm kodu zorunludur." },
        { status: 400 }
      );
    }

    const updated = await prisma.securityAlert.update({
      where: { code },
      data: { status: "CLOSED" }
    });

    sseHub.broadcast({
      type: "SECURITY_ALERT",
      title: "Güvenlik İhlali İncelendi",
      message: `${updated.code} numaralı güvenlik kaydı kapatıldı.`,
      severity: "info",
      data: { code: updated.code, status: "CLOSED" }
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.code} kaydı incelendi olarak işaretlendi.`,
      alert: { id: updated.code, status: updated.status }
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Alarm güncellenemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
