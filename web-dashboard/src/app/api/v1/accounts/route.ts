import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ADMIN_ROLES, errorDetail, requireUser } from "@/lib/api-guard";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PERM_KEY = z.string().trim().min(2).max(40).regex(/^[a-z_]+$/);

const AccountCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir kurumsal e-posta girin.").max(120),
  name: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalıdır.").max(80),
  title: z.string().trim().min(2).max(80),
  role: z.enum(["HR", "IT"]),
  branch: z.string().trim().min(2).max(20).default("ALL"),
  password: z.string().min(8, "Parola en az 8 karakter olmalıdır.").max(128),
  perms: z.array(PERM_KEY).min(1, "En az 1 modül yetkisi seçmelisiniz.").max(20)
});

const AccountPatchSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(120),
    active: z.boolean().optional(),
    perms: z.array(PERM_KEY).max(20).optional()
  })
  .refine((v) => v.active !== undefined || v.perms !== undefined, {
    message: "Güncellenecek alan yok."
  });

function toDto(acc: {
  code: string;
  email: string;
  role: string;
  name: string;
  title: string;
  branchCode: string;
  active: boolean;
  permsJson: string;
}) {
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
    active: acc.active,
    perms
  };
}

/** GET /api/v1/accounts — portal kullanıcıları (parola özeti döndürülmez). */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req, ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const rows = await prisma.userAccount.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ status: "success", accounts: rows.map(toDto) });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Kullanıcılar alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

/** POST /api/v1/accounts — yeni İK/BT portal kullanıcısı (yalnızca Admin). */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req, ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const parsed = AccountCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const exists = await prisma.userAccount.findUnique({ where: { email: d.email } });
    if (exists) {
      return NextResponse.json(
        { status: "error", message: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var." },
        { status: 409 }
      );
    }

    const created = await prisma.userAccount.create({
      data: {
        code: `ACC-${Date.now().toString(36).toUpperCase()}`,
        email: d.email,
        passwordHash: await hashPassword(d.password),
        role: d.role,
        name: d.name,
        title: d.title,
        branchCode: d.branch,
        active: true,
        permsJson: JSON.stringify(d.perms)
      }
    });

    await prisma.auditLog.create({
      data: {
        actorName: guard.user.name,
        actorRole: guard.user.role,
        action: `Yeni ${d.role === "HR" ? "İK" : "BT"} portal kullanıcısı oluşturuldu`,
        target: d.email,
        ipAddress: clientIp(req.headers)
      }
    });

    return NextResponse.json({ status: "success", account: toDto(created) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Kullanıcı oluşturulamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

/** PATCH /api/v1/accounts — hesabı askıya alma/aktifleştirme veya yetki güncelleme. */
export async function PATCH(req: NextRequest) {
  const guard = await requireUser(req, ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const parsed = AccountPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }
    const { email, active, perms } = parsed.data;

    const target = await prisma.userAccount.findUnique({ where: { email } });
    if (!target) {
      return NextResponse.json(
        { status: "error", message: "Kullanıcı bulunamadı." },
        { status: 404 }
      );
    }
    if (target.email === guard.user.email && active === false) {
      return NextResponse.json(
        { status: "error", message: "Kendi hesabınızı askıya alamazsınız." },
        { status: 400 }
      );
    }

    const updated = await prisma.userAccount.update({
      where: { email },
      data: {
        ...(active !== undefined ? { active } : {}),
        ...(perms !== undefined ? { permsJson: JSON.stringify(perms) } : {})
      }
    });

    await prisma.auditLog.create({
      data: {
        actorName: guard.user.name,
        actorRole: guard.user.role,
        action:
          active !== undefined
            ? `Kullanıcı durumu güncellendi (${active ? "AKTİF" : "ASKIDA"})`
            : `Kullanıcı yetkileri güncellendi (${perms?.length ?? 0} yetki)`,
        target: email,
        ipAddress: clientIp(req.headers)
      }
    });

    return NextResponse.json({ status: "success", account: toDto(updated) });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Kullanıcı güncellenemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
