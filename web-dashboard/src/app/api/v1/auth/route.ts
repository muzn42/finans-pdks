import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validators";
import {
  AUTH_COOKIE_NAME,
  getRequestUser,
  hashPassword,
  JwtUserPayload,
  needsRehash,
  signJwtToken,
  verifyPassword
} from "@/lib/auth";
import { errorDetail } from "@/lib/api-guard";
import {
  clearFailures,
  clientIp,
  lockRemainingSeconds,
  registerFailure
} from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    return NextResponse.json({ status: "success", user });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Oturum doğrulanamadı.", detail: errorDetail(err) },
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
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(req.headers);
    const limitKeys = [`web:ip:${ip}`, `web:acc:${normalizedEmail}`];

    const lockedFor = Math.max(...limitKeys.map((k) => lockRemainingSeconds(k)));
    if (lockedFor > 0) {
      return NextResponse.json(
        {
          status: "error",
          message: `Çok fazla hatalı deneme. ${Math.ceil(lockedFor / 60)} dakika sonra tekrar deneyin.`
        },
        { status: 429, headers: { "Retry-After": String(lockedFor) } }
      );
    }

    const account = await prisma.userAccount.findUnique({
      where: { email: normalizedEmail }
    });

    const isPasswordValid = account
      ? await verifyPassword(password, account.passwordHash)
      : false;

    if (!account || !isPasswordValid) {
      limitKeys.forEach((k) => registerFailure(k));
      await prisma.auditLog.create({
        data: {
          actorName: email,
          actorRole: "GUEST",
          action: "Başarısız oturum açma denemesi",
          target: portal || "WEB_AUTH",
          ipAddress: ip
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

    if (account.role === "PERSONNEL") {
      return NextResponse.json(
        { status: "error", message: "Personel hesapları yönetim paneline giriş yapamaz." },
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
          ipAddress: ip
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

    limitKeys.forEach((k) => clearFailures(k));

    if (needsRehash(account.passwordHash)) {
      const upgraded = await hashPassword(password);
      await prisma.userAccount
        .update({ where: { id: account.id }, data: { passwordHash: upgraded } })
        .catch(() => {});
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
        ipAddress: ip
      }
    });

    // Web paneli oturumu httpOnly çerezle taşır; token yanıt gövdesinde döndürülmez (XSS ile çalınamaz).
    const res = NextResponse.json({
      status: "success",
      user: userPayload
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: "Giriş işlemi sırasında sunucu hatası oluştu.",
        detail: errorDetail(err)
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ status: "success", message: "Oturum kapatıldı." });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
