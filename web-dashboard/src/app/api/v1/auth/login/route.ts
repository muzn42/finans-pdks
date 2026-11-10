import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJwtToken } from "@/lib/auth";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

function branchIdFromCode(branchCode: string | null | undefined): number {
  if (!branchCode) return 1;
  const m = String(branchCode).match(/(\d+)$/);
  if (m) return Math.max(1, Number(m[1]));
  return 1;
}

/**
 * Mobil Android Uygulaması Kimlik Doğrulama Uyum Katmanı:
 * POST /api/v1/auth/login
 * İstek: { employeeCode, password, deviceModel } (veya employee_code, device_id)
 * Yanıt: { token, employeeId, fullName, role, branchId, employee, success, message }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCode = String(
      body.employeeCode ?? body.employee_code ?? body.username ?? body.email ?? ""
    ).trim();
    const rawPassword = String(body.password ?? "").trim();
    const deviceModel = String(
      body.deviceModel ?? body.device_model ?? body.device_id ?? ""
    ).trim();

    if (!rawCode || !rawPassword) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          message: "Lütfen sicil numaranızı ve parolanızı giriniz."
        },
        { status: 400 }
      );
    }

    const normalizedCode = rawCode.toUpperCase();
    const dashedCode =
      /^FN\d{4}$/i.test(normalizedCode)
        ? `FN-${normalizedCode.slice(2)}`
        : normalizedCode;

    // 1. Önce sicil, e-posta veya ad-soyad ile PostgreSQL employees tablosunda ara
    let emp = await prisma.employee.findFirst({
      where: {
        OR: [
          { sicil: { equals: dashedCode, mode: "insensitive" } },
          { sicil: { equals: normalizedCode, mode: "insensitive" } },
          { email: { equals: rawCode, mode: "insensitive" } },
          { name: { equals: rawCode, mode: "insensitive" } }
        ]
      },
      include: { shift: true, branch: true }
    });

    if (!emp && /^\d+$/.test(rawCode)) {
      emp = await prisma.employee.findFirst({
        where: {
          OR: [{ id: Number(rawCode) }, { sicil: `FN-${rawCode}` }]
        },
        include: { shift: true, branch: true }
      });
    }

    // Eski demo sicil kodlarıyla (FN-1048 -> FN-1001, FN-2091 -> FN-1002, FN-3114 -> FN-1003) geriye dönük uyum
    if (!emp) {
      const legacyAliasMap: Record<string, string> = {
        "FN-1048": "FN-1001",
        "FN-2091": "FN-1002",
        "FN-3114": "FN-1003"
      };
      const mappedSicil = legacyAliasMap[dashedCode];
      if (mappedSicil) {
        emp = await prisma.employee.findUnique({
          where: { sicil: mappedSicil },
          include: { shift: true, branch: true }
        });
      }
    }

    if (!emp) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          message: `Personel sicil kaydı bulunamadı: ${rawCode}`
        },
        { status: 404 }
      );
    }

    // Mobil personel test parolaları: 123, 1234, 123456 veya Per!2026demo
    const validPasswords = new Set(["123", "1234", "123456", "Per!2026demo"]);
    if (!validPasswords.has(rawPassword)) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          message: "Hatalı parola girdiniz."
        },
        { status: 401 }
      );
    }

    // Cihaz modeli gönderildiyse personelin aktif cihaz bilgisini güncelle
    if (deviceModel && deviceModel !== emp.deviceModel) {
      await prisma.employee
        .update({
          where: { id: emp.id },
          data: { deviceModel }
        })
        .catch(() => {});
    }

    const branchId = branchIdFromCode(emp.branchCode);
    const token = await signJwtToken({
      id: `EMP-${emp.id}`,
      email: emp.email,
      role: "PERSONNEL",
      name: emp.name,
      title: emp.title,
      branch: emp.branchCode,
      employeeSicil: emp.sicil,
      perms: []
    });

    await prisma.auditLog
      .create({
        data: {
          actorName: `${emp.name} (${emp.sicil})`,
          actorRole: "PERSONNEL",
          action: "Mobil uygulamadan oturum açıldı",
          target: `${emp.branchCode}${deviceModel ? ` · ${deviceModel}` : ""}`,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      })
      .catch(() => {});

    sseHub.broadcast({
      type: "ATTENDANCE_UPDATE",
      title: "Mobil Uygulama Girişi",
      message: `${emp.name} (${emp.sicil}) mobil portal üzerinden bağlandı.`,
      severity: "info",
      data: {
        employeeId: emp.id,
        sicil: emp.sicil,
        name: emp.name,
        branch: emp.branchCode
      }
    });

    return NextResponse.json({
      success: true,
      status: "success",
      token,
      employeeId: emp.id,
      fullName: emp.name,
      role: "PERSONNEL",
      branchId,
      branchCode: emp.branchCode,
      shiftStartMin: emp.shift?.startMin ?? 510,
      shiftEndMin: emp.shift?.endMin ?? 1050,
      shiftGraceMin: emp.shift?.graceMin ?? 5,
      employee: {
        id: emp.id,
        employee_code: emp.sicil,
        employeeCode: emp.sicil,
        full_name: emp.name,
        fullName: emp.name,
        department: emp.dept,
        title: emp.title,
        email: emp.email,
        branch_id: branchId,
        branchId,
        branch_code: emp.branchCode,
        branchCode: emp.branchCode,
        role: "PERSONNEL",
        shiftStartMin: emp.shift?.startMin ?? 510,
        shiftEndMin: emp.shift?.endMin ?? 1050,
        shiftGraceMin: emp.shift?.graceMin ?? 5
      },
      message: "Albayrak Finans PDKS sunucusuna başarıyla giriş yapıldı."
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: "Mobil oturum açma sırasında sunucu hatası oluştu.",
        detail: String(err)
      },
      { status: 500 }
    );
  }
}
