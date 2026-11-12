import { NextRequest, NextResponse } from "next/server";
import { errorDetail, HR_APPROVER_ROLES, requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Europe/Istanbul gününü YYYY-MM-DD olarak döndürür (DailyAttendance.workDate formatı). */
function todayIsoIstanbul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const guard = await requireUser(req, HR_APPROVER_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await context.params;
    const recordId = Number(id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return NextResponse.json({ status: "error", message: "Geçersiz kayıt kimliği." }, { status: 400 });
    }

    const body = (await req.json()) as {
      action?: string;
      excusedMinutes?: number;
      reviewerName?: string;
    };
    const action = String(body.action || "").toLowerCase();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { status: "error", message: "action 'approve' veya 'reject' olmalıdır." },
        { status: 400 }
      );
    }

    const record = await prisma.dailyAttendance.findUnique({
      where: { id: recordId },
      include: { employee: { select: { id: true, sicil: true, name: true, dept: true, branchCode: true } } }
    });
    if (!record) {
      return NextResponse.json({ status: "error", message: "Gecikme kaydı bulunamadı." }, { status: 404 });
    }

    const reviewer = String(body.reviewerName || "Zehra Yılmaz (İK)").trim();
    const rawLate = Math.max(0, record.lateMin || 0);
    const requested = Number(body.excusedMinutes);
    const excused =
      action === "approve"
        ? Math.max(0, Math.min(rawLate, Number.isFinite(requested) ? Math.round(requested) : rawLate))
        : 0;
    const status = action === "approve" ? "APPROVED" : "REJECTED";

    const updated = await prisma.$transaction(async (tx) => {
      const after = await tx.dailyAttendance.update({
        where: { id: recordId },
        data: {
          lateExcuseStatus: status,
          lateExcusedMin: excused,
          lateReviewedBy: reviewer,
          lateReviewedAtUtc: new Date()
        }
      });

      // Gecikme kaydı bugüne aitse, personelin "bugün" özetini de güncelle.
      // Giriş kaydı (check-in saati / access log) DEĞİŞMEZ; yalnızca düşülen dakika işlenir.
      if (record.workDate === todayIsoIstanbul()) {
        await tx.employee.update({
          where: { id: record.employeeId },
          data: { lateExcusedMin: excused }
        });
      }

      await tx.auditLog.create({
        data: {
          actorName: reviewer,
          actorRole: "HR",
          action:
            action === "approve"
              ? `Gecikme gerekçesi haklı bulundu (${excused} dk düşüldü)`
              : "Gecikme gerekçesi reddedildi",
          target: `${record.employee.sicil} · ${record.employee.name} · ${record.workDate}`,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      });

      return after;
    });

    const netLate = Math.max(0, rawLate - excused);

    sseHub.broadcast({
      type: "LATE_REASON_UPDATE",
      title: action === "approve" ? "Gecikme Gerekçesi Kabul Edildi" : "Gecikme Gerekçesi Reddedildi",
      message:
        action === "approve"
          ? `${record.employee.name} · ${record.workDate} · ${excused} dk gecikmeden düşüldü (kalan ${netLate} dk)`
          : `${record.employee.name} · ${record.workDate} · gerekçe reddedildi (${rawLate} dk geçerli)`,
      severity: action === "approve" ? "ok" : "warn",
      data: {
        recordId,
        employeeId: record.employeeId,
        workDate: record.workDate,
        status,
        excusedMin: excused,
        netLateMin: netLate
      }
    });

    return NextResponse.json({
      status: "success",
      message:
        action === "approve"
          ? `Gerekçe haklı bulundu; ${excused} dk gecikmeden düşüldü. Giriş kaydı değişmedi.`
          : "Gerekçe reddedildi; gecikme süresi aynen geçerli.",
      record: {
        id: updated.id,
        employeeId: updated.employeeId,
        workDate: updated.workDate,
        lateMin: rawLate,
        lateExcusedMin: updated.lateExcusedMin,
        netLateMin: netLate,
        status: updated.lateExcuseStatus,
        reviewedBy: updated.lateReviewedBy
      }
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Gecikme gerekçesi değerlendirilemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
