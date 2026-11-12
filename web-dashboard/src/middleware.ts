import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

/**
 * Oturum gerektirmeyen API uçları (yöntem + yol).
 * Buraya eklenmeyen her /api/v1/* isteği geçerli JWT olmadan reddedilir
 * (varsayılan olarak kapalı / deny-by-default). Rol kontrolü her rotada ayrıca yapılır.
 */
const PUBLIC_API: ReadonlyArray<{ method: string; path: string }> = [
  { method: "GET", path: "/api/v1/auth" },
  { method: "POST", path: "/api/v1/auth" },
  { method: "DELETE", path: "/api/v1/auth" },
  { method: "POST", path: "/api/v1/auth/login" }
];

function isPublicApi(method: string, pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "");
  return PUBLIC_API.some((r) => r.method === method && r.path === normalized);
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/v1/") &&
    req.method !== "OPTIONS" &&
    !isPublicApi(req.method, pathname)
  ) {
    const user = await getRequestUser(req);
    if (!user) {
      return withSecurityHeaders(
        NextResponse.json(
          { status: "error", success: false, message: "Oturum açmanız gerekiyor." },
          { status: 401 }
        )
      );
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/|legacy/).*)"]
};
