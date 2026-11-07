import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validators";
import {
  AUTH_COOKIE_NAME,
  getRequestUser,
  JwtUserPayload,
  signJwtToken,
  verifyPassword
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    return NextResponse.json({ status: "success", user });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Oturum doğrulanamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Geçersiz giriş bilgileri.";
      return NextResponse.json({ status: "error", message: firstIssue }, { status: 400 });
    }

    const { email, password, portal } = parsed.data;
    const account = await prisma.userAccount.findUnique({
      where: { email: email.toLowerCase() }
    });

    const isPasswordValid = account
      ? await verifyPassword(password, account.passwordHash)
      : false;

    if (!account || !isPasswordValid) {
      await prisma.auditLog.create({
        data: {
          actorName: email,
          actorRole: "GUEST",
          action: "Başarısız oturum açma denemesi",
          target: portal || "WEB_AUTH",
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      });
      return NextResponse.json(
        { status: "error", message: "E-posta veya parola hatalı." },
        { status: 401 }
      );
    }

    if (!account.active) {
      return NextResponse.json(
        { status: "error", message: "Bu yönetici hesabı pasif durumdadır." },
        { status: 403 }
      );
    }

    if (
      portal &&
      account.role !== "ADMIN" &&
      portal !== account.role &&
      !(portal === "HR" && account.role === "DEPT_MANAGER")
    ) {
      await prisma.auditLog.create({
        data: {
          actorName: account.name,
          actorRole: account.role,
          action: `Yetkisiz portal giriş denemesi (${portal})`,
          target: account.email,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      });
      return NextResponse.json(
        {
          status: "error",
          message: `Bu hesap (${account.role}) seçilen birime (${portal}) erişim yetkisine sahip değil.`
        },
        { status: 403 }
      );
    }

    let perms: string[] = [];
    try {
      perms = JSON.parse(account.permsJson);
    } catch {
      perms = [];
    }

    const userPayload: JwtUserPayload = {
      id: account.code,
      email: account.email,
      role: account.role as JwtUserPayload["role"],
      name: account.name,
      title: account.title,
      branch: account.branchCode,
      managedDept: account.managedDept,
      employeeSicil: account.employeeSicil,
      perms
    };

    const token = await signJwtToken(userPayload);

    await prisma.auditLog.create({
      data: {
        actorName: account.name,
        actorRole: account.role,
        action: "Yönetim portalına giriş yapıldı (JWT)",
        target: `${account.role} Portalı`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    const res = NextResponse.json({
      status: "success",
      token,
      user: userPayload
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Giriş işlemi sırasında sunucu hatası oluştu.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ status: "success", message: "Oturum kapatıldı." });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
