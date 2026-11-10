import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShiftUpdateSchema } from "@/lib/validators";
import { minFromHhmm } from "@/lib/pdks-engine";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function resolveAssignment(
  shiftId: number,
  assignment: { scope: "all" | "branches" | "employees"; branchCodes: string[]; employeeIds: number[] }
) {
  const where =
    assignment.scope === "all"
      ? {}
      : assignment.scope === "branches"
      ? { branchCode: { in: assignment.branchCodes } }
      : { id: { in: assignment.employeeIds } };

  const res = await prisma.employee.updateMany({
    where: where as never,
    data: { shiftId }
  });
  return res.count;
}

export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params;
    const shiftId = Number(id);
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return NextResponse.json({ status: "error", message: "Geçersiz vardiya kimliği." }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!existing) {
      return NextResponse.json({ status: "error", message: "Vardiya şablonu bulunamadı." }, { status: 404 });
    }

    const parsed = ShiftUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message: parsed.error.issues[0]?.message || "Geçersiz vardiya güncellemesi." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.code != null) data.code = d.code.toUpperCase();
    if (d.name != null) data.name = d.name;
    if (d.startClock != null) data.startMin = minFromHhmm(d.startClock) ?? existing.startMin;
    if (d.endClock != null) data.endMin = minFromHhmm(d.endClock) ?? existing.endMin;
    if (d.breakMin != null) data.breakMin = d.breakMin;
    if (d.graceMin != null) data.graceMin = d.graceMin;
    if (d.isFlexible != null) data.isFlexible = d.isFlexible;

    const updated = await prisma.shift.update({ where: { id: shiftId }, data });

    let assigned = 0;
    if (d.assignment) assigned = await resolveAssignment(shiftId, d.assignment);

    sseHub.broadcast({
      type: "SHIFT_UPDATE",
      title: "Vardiya Şablonu Güncellendi",
      message: `${updated.name} (${updated.code}) güncellendi${assigned ? ` · ${assigned} personel atandı` : ""}.`,
      severity: "ok",
      data: { shift: updated, assigned }
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.name} vardiyası güncellendi${assigned ? ` ve ${assigned} personele atandı` : ""}.`,
      shift: updated,
      assigned
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { status: "error", message: "Bu vardiya kodu zaten kullanılıyor." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { status: "error", message: "Vardiya güncellenemedi.", detail: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params;
    const shiftId = Number(id);
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return NextResponse.json({ status: "error", message: "Geçersiz vardiya kimliği." }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!existing) {
      return NextResponse.json({ status: "error", message: "Vardiya şablonu bulunamadı." }, { status: 404 });
    }

    const total = await prisma.shift.count();
    if (total <= 1) {
      return NextResponse.json(
        { status: "error", message: "Sistemde tek vardiya şablonu kaldığı için silinemez." },
        { status: 409 }
      );
    }

    const requested = Number(req.nextUrl.searchParams.get("reassignTo"));
    let target = Number.isInteger(requested) && requested > 0 && requested !== shiftId
      ? await prisma.shift.findUnique({ where: { id: requested } })
      : null;
    if (!target) {
      target = await prisma.shift.findFirst({ where: { id: { not: shiftId } }, orderBy: { id: "asc" } });
    }
    if (!target) {
      return NextResponse.json(
        { status: "error", message: "Personellerin aktarılacağı bir vardiya şablonu bulunamadı." },
        { status: 409 }
      );
    }

    const moved = await prisma.$transaction(async (tx) => {
      const res = await tx.employee.updateMany({
        where: { shiftId },
        data: { shiftId: target.id }
      });
      await tx.shift.delete({ where: { id: shiftId } });
      return res.count;
    });

    sseHub.broadcast({
      type: "SHIFT_UPDATE",
      title: "Vardiya Şablonu Silindi",
      message: `${existing.name} silindi${moved ? ` · ${moved} personel ${target.name} vardiyasına aktarıldı` : ""}.`,
      severity: "warn",
      data: { shiftId, reassignTo: target.id, moved }
    });

    return NextResponse.json({
      status: "success",
      message: `${existing.name} vardiyası silindi${moved ? `, ${moved} personel ${target.name} vardiyasına aktarıldı` : ""}.`,
      reassignTo: target.id,
      moved
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Vardiya silinemedi.", detail: String(err) },
      { status: 500 }
    );
  }
}
