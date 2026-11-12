import { NextRequest, NextResponse } from "next/server";
import { ANY_ROLE, errorDetail, IT_ROLES, requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { normalizeBssid, parseBssidList } from "@/lib/validators";
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
  wifi: z.string().trim().min(3).max(64),
  wifiBssid: z.string().trim().max(32).optional().default(""),
  backupWifiBssids: z.union([z.string(), z.array(z.string())]).optional().default(""),
  wifiEnforcementMode: z.enum(["LEARNING", "STRICT"]).optional().default("LEARNING")
});

export async function GET(req: NextRequest) {
  // Mobil uygulama (PERSONNEL) şube koordinatlarını okuyabilmeli.
  const guard = await requireUser(req, ANY_ROLE);
  if (!guard.ok) return guard.response;
  try {
    const rows = await prisma.branch.findMany({ orderBy: { code: "asc" } });
    const mapped = rows.map((b, idx) => {
      const m = String(b.code).match(/(\d+)$/);
      const numId = m ? Math.max(1, Number(m[1])) : idx + 1;
      return {
        id: numId,
        dbId: b.id,
        code: b.code,
        branch_code: b.code,
        branchCode: b.code,
        name: b.name,
        city: b.city,
        district: b.district,
        address: b.address,
        phone: b.phone || "444 88 61",
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
        wifiSsid: b.wifiSsid,
        wifiBssid: b.wifiBssid || "",
        backupWifiBssids: b.backupWifiBssids || "",
        backupBssidsList: parseBssidList(b.backupWifiBssids),
        wifiEnforcementMode: b.wifiEnforcementMode || "LEARNING",
        is_default: b.code === "ŞB-001" || numId === 1,
        isDefault: b.code === "ŞB-001" || numId === 1
      };
    });

    const { searchParams } = new URL(req.url);
    if (searchParams.get("wrap") === "1" || searchParams.get("format") === "object") {
      return NextResponse.json({
        status: "success",
        count: mapped.length,
        branches: mapped
      });
    }

    // Android Retrofit PdksApiService.getBranches() doğrudan JSON dizi (List<BranchDto>) bekler.
    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube listesi alınamadı.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req, IT_ROLES);
  if (!guard.ok) return guard.response;
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
    const primaryBssid = d.wifiBssid ? normalizeBssid(d.wifiBssid) : "";
    if (d.wifiBssid && !primaryBssid) {
      return NextResponse.json(
        {
          status: "error",
          message: "Ana modem MAC (BSSID) adresi geçersiz (örn. a4:2b:8c:1d:e5:9f)."
        },
        { status: 400 }
      );
    }
    const backupBssids = parseBssidList(d.backupWifiBssids).filter((x) => x !== primaryBssid);

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
        wifiSsid: d.wifi,
        wifiBssid: primaryBssid,
        backupWifiBssids: backupBssids.join(", "),
        wifiEnforcementMode: d.wifiEnforcementMode
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
        wifiBssid: primaryBssid,
        backupWifiBssids: backupBssids.join(", "),
        wifiEnforcementMode: d.wifiEnforcementMode,
        weight: 0.02
      }
    });

    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: "Yeni şube, 30m geofence & BSSID tanımlandı",
        target: `${created.code} · ${created.name}${primaryBssid ? ` (${primaryBssid})` : ""}`,
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
          wifi: created.wifiSsid,
          wifiBssid: created.wifiBssid,
          backupWifiBssids: created.backupWifiBssids,
          wifiEnforcementMode: created.wifiEnforcementMode
        }
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube kaydedilemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
