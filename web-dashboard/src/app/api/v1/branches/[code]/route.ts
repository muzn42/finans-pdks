import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BranchUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    city: z.string().trim().min(2).max(60).optional(),
    district: z.string().trim().max(60).optional(),
    address: z.string().trim().max(260).optional(),
    phone: z.string().trim().max(32).optional(),
    googleMapUrl: z
      .string()
      .trim()
      .max(300)
      .refine(
        (u) => !u || u.startsWith("https://"),
        "Yalnızca güvenli https:// harita bağlantısı kabul edilir."
      )
      .optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(10).max(200).optional(),
    wifi: z.string().trim().min(3).max(64).optional(),
    weight: z.coerce.number().min(0).max(1).optional()
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Güncellenecek en az bir alan gönderilmelidir."
  });

function serializeBranch(b: {
  id: number;
  code: string;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  googleMapUrl: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  wifiSsid: string;
  weight: number;
}) {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    city: b.city,
    district: b.district,
    address: b.address,
    phone: b.phone,
    googleMapUrl: b.googleMapUrl,
    lat: b.lat,
    lng: b.lng,
    radius: b.radiusMeters,
    wifi: b.wifiSsid,
    weight: b.weight
  };
}

function normalizeCode(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const branch = await prisma.branch.findUnique({
      where: { code: normalizeCode(code) }
    });
    if (!branch) {
      return NextResponse.json(
        { status: "error", message: "Şube bulunamadı." },
        { status: 404 }
      );
    }
    const employeeCount = await prisma.employee.count({
      where: { branchCode: branch.code }
    });
    return NextResponse.json({
      status: "success",
      branch: { ...serializeBranch(branch), employeeCount }
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube okunamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

async function handleUpdate(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const branchCode = normalizeCode(code);
    const existing = await prisma.branch.findUnique({ where: { code: branchCode } });
    if (!existing) {
      return NextResponse.json(
        { status: "error", message: `${branchCode} kodlu şube bulunamadı.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = BranchUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz şube verisi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const lat = d.lat != null ? d.lat : existing.lat;
    const lng = d.lng != null ? d.lng : existing.lng;

    const updated = await prisma.branch.update({
      where: { code: branchCode },
      data: {
        ...(d.name != null ? { name: d.name } : {}),
        ...(d.city != null ? { city: d.city } : {}),
        ...(d.district != null ? { district: d.district } : {}),
        ...(d.address != null ? { address: d.address } : {}),
        ...(d.phone != null ? { phone: d.phone } : {}),
        ...(d.googleMapUrl != null
          ? {
              googleMapUrl:
                d.googleMapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            }
          : {}),
        ...(d.lat != null ? { lat: d.lat } : {}),
        ...(d.lng != null ? { lng: d.lng } : {}),
        ...(d.radius != null ? { radiusMeters: d.radius } : {}),
        ...(d.wifi != null ? { wifiSsid: d.wifi } : {}),
        ...(d.weight != null ? { weight: d.weight } : {})
      }
    });

    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: "Şube bilgileri ve 30m geofence güncellendi",
        target: `${updated.code} · ${updated.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.name} (${updated.code}) güncellendi.`,
      branch: serializeBranch(updated)
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube güncellenemedi.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  return handleUpdate(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  return handleUpdate(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const branchCode = normalizeCode(code);
    const existing = await prisma.branch.findUnique({
      where: { code: branchCode },
      include: { _count: { select: { employees: true } } }
    });
    if (!existing) {
      return NextResponse.json(
        { status: "error", message: `${branchCode} kodlu şube bulunamadı.` },
        { status: 404 }
      );
    }
    if (existing._count.employees > 0) {
      return NextResponse.json(
        {
          status: "error",
          message: `${existing.name} şubesinde ${existing._count.employees} personel kayıtlı. Silmeden önce personeli başka bir şubeye aktarın.`
        },
        { status: 409 }
      );
    }

    await prisma.branch.delete({ where: { code: branchCode } });
    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: "Şube kaydı silindi",
        target: `${existing.code} · ${existing.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    return NextResponse.json({
      status: "success",
      message: `${existing.name} (${existing.code}) silindi.`,
      deleted: serializeBranch(existing)
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Şube silinemedi.", detail: String(err) },
      { status: 500 }
    );
  }
}
