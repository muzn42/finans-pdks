import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BranchCreateSchema = z.object({
  code: z.string().trim().min(2).max(12),
  name: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().max(60).optional().default(""),
  address: z.string().trim().max(260).optional().default(""),
  phone: z.string().trim().max(32).optional().default("444 88 61"),
  googleMapUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (u) => !u || u.startsWith("https://"),
      "Yalnızca güvenli https:// harita bağlantısı kabul edilir."
    )
    .optional()
    .default(""),
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
        branch_code: b.code,
        branchCode: b.code,
        name: b.name,
        city: b.city,
        district: b.district,
        address: b.address,
        phone: b.phone,
        googleMapUrl: b.googleMapUrl,
        lat: b.lat,
        lng: b.lng,
        latitude: b.lat,
        longitude: b.lng,
        radius: b.radiusMeters,
        radius_meters: b.radiusMeters,
        radiusMeters: b.radiusMeters,
        wifi: b.wifiSsid,
        wifi_ssid: b.wifiSsid,
        wifiSsid: b.wifiSsid
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
        district: d.district,
        address: d.address,
        phone: d.phone,
        googleMapUrl:
          d.googleMapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`,
        lat: d.lat,
        lng: d.lng,
        radiusMeters: d.radius,
        wifiSsid: d.wifi
      },
      create: {
        code: d.code.toUpperCase(),
        name: d.name,
        city: d.city,
        district: d.district,
        address: d.address,
        phone: d.phone,
        googleMapUrl:
          d.googleMapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`,
        lat: d.lat,
        lng: d.lng,
        radiusMeters: d.radius,
        wifiSsid: d.wifi,
        weight: 0.02
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
