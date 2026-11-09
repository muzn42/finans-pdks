import { NextRequest, NextResponse } from "next/server";
import { verifyJwtToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Güvenlik ve Cloudflare Tunnel uyumluluk başlıkları
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // /api/v1/admin/* gibi korumalı rotalarda JWT doğrulaması
  if (pathname.startsWith("/api/v1/admin")) {
    const token =
      req.cookies.get(AUTH_COOKIE_NAME)?.value ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const user = token ? await verifyJwtToken(token) : null;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { status: "error", message: "Yetkisiz erişim (RBAC Guard)." },
        { status: 403 }
      );
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/|legacy/).*)"]
};
