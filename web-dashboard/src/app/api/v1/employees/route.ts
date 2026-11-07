import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmployeeCreateSchema } from "@/lib/validators";
import { calculateAttendanceMetrics, hhmmFromMin, minFromHhmm } from "@/lib/pdks-engine";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

function trSlug(s: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u"
  };
  return s
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function serializeEmployee(e: {
  id: number;
  sicil: string;
  name: string;
  dept: string;
  title: string;
  branchCode: string;
  shiftId: number;
  status: string;
  inMin: number | null;
  outMin: number | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMin: number;
  overtimeMin: number;
  distMeters: number;
  deviceModel: string;
  deviceOs: string;
  appVersion: string;
  deviceBound: boolean;
  email: string;
  hireDate: string;
  leaveUsedDays: number;
  leaveTotalDays: number;
  shift?: { name: string; startMin: number; endMin: number } | null;
}) {
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const branch = searchParams.get("branch")?.trim() || "ALL";
    const dept = searchParams.get("dept")?.trim() || "ALL";
    const status = searchParams.get("status")?.trim() || "ALL";
    const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit") || 1000)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    const where: Record<string, unknown> = {};
    if (branch !== "ALL") where.branchCode = branch;
    if (dept !== "ALL") where.dept = dept;
    if (status !== "ALL") where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sicil: { contains: q, mode: "insensitive" } },
        { dept: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } }
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: { shift: true },
        orderBy: { id: "asc" },
        skip: offset,
        take: limit
      })
    ]);

    const serialized = rows.map((r) => ({
      ...serializeEmployee(r),
      startDate: r.hireDate,
      tone: 1 + (r.id % 5),
      proneLateDow: [1, 1, 5, 2, 4, 3][r.id % 6],
      proneOtDow: [2, 3, 4, 1, 5][r.id % 5],
      workHabitBias: +(0.35 + ((r.id * 17) % 60) / 100).toFixed(2)
    }));

    return NextResponse.json({
      status: "success",
      total,
      count: rows.length,
      limit,
      offset,
      items: serialized,
      employees: serialized
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel listesi alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EmployeeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz personel verisi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    let sicil = data.sicil;
    if (!sicil) {
      const latest = await prisma.employee.findFirst({
        orderBy: { id: "desc" },
        select: { id: true, sicil: true }
      });
      const m = latest?.sicil ? /^FN-(\d+)$/.exec(latest.sicil) : null;
      const baseNum = m ? Math.max(1500, Number(m[1])) : 1000 + (latest?.id ?? 500);
      sicil = `FN-${baseNum + 1}`;
    } else {
      const existing = await prisma.employee.findUnique({ where: { sicil } });
      if (existing) {
        return NextResponse.json(
          { status: "error", message: `${sicil} sicil numarası zaten kayıtlı.` },
          { status: 400 }
        );
      }
    }

    const shift =
      (await prisma.shift.findUnique({ where: { id: data.shiftId } })) ||
      (await prisma.shift.findFirst());

    const inMin =
      data.status === "LEAVE" || data.status === "ABSENT"
        ? null
        : minFromHhmm(data.checkIn) ?? 8 * 60 + 26;
    const outMin =
      data.status === "LEAVE" || data.status === "ABSENT"
        ? null
        : minFromHhmm(data.checkOut) ?? 17 * 60 + 35;

    const calc = calculateAttendanceMetrics({
      inMin,
      outMin,
      shiftStartMin: shift?.startMin ?? 510,
      shiftEndMin: shift?.endMin ?? 1050,
      shiftGraceMin: shift?.graceMin ?? 5,
      shiftBreakMin: shift?.breakMin ?? 60
    });

    const finalStatus =
      data.status === "LEAVE" || data.status === "ABSENT" ? data.status : calc.status;

    const created = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          sicil,
          name: data.name,
          dept: data.dept,
          title: data.title,
          branchCode: data.branch,
          shiftId: shift?.id ?? 1,
          status: finalStatus,
          inMin,
          outMin,
          checkIn: hhmmFromMin(inMin),
          checkOut: hhmmFromMin(outMin),
          lateMin: finalStatus === "LEAVE" || finalStatus === "ABSENT" ? 0 : calc.lateMin,
          overtimeMin: finalStatus === "LEAVE" || finalStatus === "ABSENT" ? 0 : calc.overtimeMin,
          distMeters: data.dist,
          deviceModel: data.device,
          deviceOs: data.os,
          appVersion: data.ver,
          deviceBound: data.bound,
          email: data.email || `${trSlug(data.name)}@albayrakfinans.com.tr`,
          hireDate: data.hireDate || new Date().toISOString().slice(0, 10),
          leaveUsedDays: data.leaveUsed,
          leaveTotalDays: data.leaveTotal
        },
        include: { shift: true }
      });

      await tx.auditLog.create({
        data: {
          actorName: "İK Yönetimi",
          actorRole: "HR",
          action: "Yeni personel işe giriş kaydı (PostgreSQL)",
          target: `${emp.sicil} · ${emp.name} (${emp.dept})`,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      });

      return emp;
    });

    const employeeDto = serializeEmployee(created);
    sseHub.broadcast({
      type: "EMPLOYEE_CRUD",
      title: "Yeni Personel Kaydı",
      message: `${created.name} (${created.sicil}) ${created.dept} birimine eklendi.`,
      severity: "ok",
      data: { action: "CREATE", employee: employeeDto }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${created.name} (${created.sicil}) başarıyla kaydedildi.`,
        employee: employeeDto
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Personel oluşturulamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}
