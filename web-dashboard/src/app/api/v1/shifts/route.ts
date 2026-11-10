import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShiftCreateSchema, ShiftAssignSchema } from "@/lib/validators";
import { minFromHhmm } from "@/lib/pdks-engine";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const shifts = await prisma.shift.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { id: "asc" }
    });
    return NextResponse.json({
      status: "success",
      shifts: shifts.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        startMin: s.startMin,
        endMin: s.endMin,
        breakMin: s.breakMin,
        graceMin: s.graceMin,
        isFlexible: s.isFlexible,
        employeeCount: s._count.employees
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Vardiya şablonları alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ShiftCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz vardiya şablonu."
        },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const startMin = minFromHhmm(d.startClock) ?? 510;
    const endMin = minFromHhmm(d.endClock) ?? 1050;

    const created = await prisma.shift.create({
      data: {
        code: d.code.toUpperCase(),
        name: d.name,
        startMin,
        endMin,
        breakMin: d.breakMin,
        graceMin: d.graceMin,
        isFlexible: d.isFlexible
      }
    });

    // Yeni şablon oluşturulurken istenirse doğrudan atama da yapılabilir
    let assigned = 0;
    const assignParsed = ShiftAssignSchema.safeParse((body as { assignment?: unknown }).assignment);
    if (assignParsed.success) {
      const a = assignParsed.data;
      const where =
        a.scope === "all"
          ? {}
          : a.scope === "branches"
          ? { branchCode: { in: a.branchCodes } }
          : { id: { in: a.employeeIds } };
      const res = await prisma.employee.updateMany({
        where: where as never,
        data: { shiftId: created.id }
      });
      assigned = res.count;
    }

    sseHub.broadcast({
      type: "SHIFT_UPDATE",
      title: "Yeni Vardiya Şablonu",
      message: `${created.name} (${d.startClock} – ${d.endClock}) tanımlandı${assigned ? ` · ${assigned} personel atandı` : ""}.`,
      severity: "ok",
      data: { shift: created, assigned }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${created.name} vardiyası oluşturuldu${assigned ? ` ve ${assigned} personele atandı` : ""}.`,
        shift: created,
        assigned
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Vardiya oluşturulamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}
