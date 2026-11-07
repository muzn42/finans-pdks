import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BranchCreateSchema = z.object({
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(3).max(100),
  city: z.string().trim().min(2).max(60),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(10).max(200).default(30),
  wifi: z.string().trim().min(3).max(64)
});

export async function GET() {
  try {
    const rows = await prisma.branch.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({
      status: "success",
      count: rows.length,
      branches: rows.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        city: b.city,
        lat: b.lat,
        lng: b.lng,
        radius: b.radiusMeters,
        radius_meters: b.radiusMeters,
        wifi: b.wifiSsid
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube listesi alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BranchCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz şube verisi."
        },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const created = await prisma.branch.upsert({
      where: { code: d.code.toUpperCase() },
      update: {
        name: d.name,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
        radiusMeters: d.radius,
        wifiSsid: d.wifi
      },
      create: {
        code: d.code.toUpperCase(),
        name: d.name,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
        radiusMeters: d.radius,
        wifiSsid: d.wifi,
        weight: 0.08
      }
    });

    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: "Yeni şube & 30m geofence tanımlandı",
        target: `${created.code} · ${created.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${created.name} (${created.code}) 30m geofence ile kaydedildi.`,
        branch: {
          code: created.code,
          name: created.name,
          city: created.city,
          lat: created.lat,
          lng: created.lng,
          radius: created.radiusMeters,
          wifi: created.wifiSsid
        }
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube kaydedilemedi.", detail: String(err) },
      { status: 500 }
    );
  }
}
