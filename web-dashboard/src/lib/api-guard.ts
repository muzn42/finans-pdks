import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, JwtUserPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

export type Role = JwtUserPayload["role"];

/** Yönetim paneline giren tüm personel dışı roller. */
export const STAFF_ROLES: readonly Role[] = ["HR", "IT", "ADMIN", "DEPT_MANAGER"];
export const HR_ROLES: readonly Role[] = ["HR", "ADMIN"];
export const HR_APPROVER_ROLES: readonly Role[] = ["HR", "DEPT_MANAGER", "ADMIN"];
export const IT_ROLES: readonly Role[] = ["IT", "ADMIN"];
export const ADMIN_ROLES: readonly Role[] = ["ADMIN"];
export const ANY_ROLE: readonly Role[] = [...STAFF_ROLES, "PERSONNEL"];

export type GuardResult =
  | { ok: true; user: JwtUserPayload }
  | { ok: false; response: NextResponse };

/**
 * Rota koruması: geçerli JWT (çerez veya Bearer) ve izin verilen rol şartı.
 * Yetkisiz erişim denemeleri denetim günlüğüne (audit log) yazılır.
 */
export async function requireUser(
  req: NextRequest,
  allowed: readonly Role[]
): Promise<GuardResult> {
  const user = await getRequestUser(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", success: false, message: "Oturum açmanız gerekiyor." },
        { status: 401 }
      )
    };
  }

  if (!allowed.includes(user.role)) {
    const pathname = new URL(req.url).pathname;
    await prisma.auditLog
      .create({
        data: {
          actorName: user.name,
          actorRole: user.role,
          action: `Yetkisiz API erişim denemesi (${req.method})`,
          target: pathname,
          ipAddress: clientIp(req.headers)
        }
      })
      .catch(() => {});
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", success: false, message: "Bu işlem için yetkiniz yok (RBAC)." },
        { status: 403 }
      )
    };
  }

  return { ok: true, user };
}

/**
 * Hata ayrıntısını yalnızca geliştirme ortamında istemciye döndürür;
 * canlı ortamda iç hata metni sızdırılmaz, sunucu günlüğüne yazılır.
 */
export function errorDetail(err: unknown): string | undefined {
  console.error("[api]", err);
  return process.env.NODE_ENV === "production" ? undefined : String(err);
}

/** Demo modu: mobil test parolaları ve demo hesaplar. Canlıda PDKS_DEMO_MODE=false yapılmalı. */
export function isDemoMode(): boolean {
  return process.env.PDKS_DEMO_MODE !== "false";
}
