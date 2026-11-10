import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeBssid, parseBssidList } from "@/lib/validators";
import { computeBranchWifiDiscovery } from "@/lib/wifi-discovery";
import { sseHub } from "@/lib/sse";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AssignWifiSchema = z.object({
  branchCode: z.string().trim().min(2),
  bssid: z.string().trim().min(11),
  ssid: z.string().trim().optional(),
  role: z.enum(["PRIMARY", "BACKUP", "REMOVE"]).default("PRIMARY"),
  enforcementMode: z.enum(["LEARNING", "STRICT"]).optional()
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchCode = searchParams.get("branchCode")?.trim().toUpperCase();
    const candidates = await computeBranchWifiDiscovery();
    const filtered = branchCode
      ? candidates.filter((c) => c.branchCode.toUpperCase() === branchCode)
      : candidates;

    return NextResponse.json({
      status: "success",
      count: filtered.length,
      candidates: filtered
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Ortak Wi-Fi BSSID keşif listesi alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AssignWifiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz BSSID atama isteği."
        },
        { status: 400 }
      );
    }

    const { branchCode, bssid, ssid, role, enforcementMode } = parsed.data;
    const normBssid = normalizeBssid(bssid);
    if (!normBssid) {
      return NextResponse.json(
        {
          status: "error",
          message: "Geçersiz modem MAC (BSSID) formatı (örn. a4:2b:8c:1d:e5:9f)."
        },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.findUnique({
      where: { code: branchCode.toUpperCase() }
    });
    if (!branch) {
      return NextResponse.json(
        { status: "error", message: `${branchCode} kodlu şube bulunamadı.` },
        { status: 404 }
      );
    }

    let nextPrimary = normalizeBssid(branch.wifiBssid);
    let nextBackups = parseBssidList(branch.backupWifiBssids);
    let nextSsid = branch.wifiSsid;

    if (role === "PRIMARY") {
      // Eski ana modem varsa yedeklere kaydırılabilir
      if (nextPrimary && nextPrimary !== normBssid && !nextBackups.includes(nextPrimary)) {
        nextBackups.unshift(nextPrimary);
      }
      nextPrimary = normBssid;
      nextBackups = nextBackups.filter((x) => x !== normBssid);
      if (ssid && ssid.trim().length >= 3) {
        nextSsid = ssid.trim();
      }
    } else if (role === "BACKUP") {
      if (nextPrimary === normBssid) {
        nextPrimary = "";
      }
      if (!nextBackups.includes(normBssid)) {
        nextBackups.push(normBssid);
      }
    } else if (role === "REMOVE") {
      if (nextPrimary === normBssid) nextPrimary = "";
      nextBackups = nextBackups.filter((x) => x !== normBssid);
    }

    const updated = await prisma.branch.update({
      where: { code: branch.code },
      data: {
        wifiBssid: nextPrimary,
        backupWifiBssids: nextBackups.join(", "),
        wifiSsid: nextSsid,
        ...(enforcementMode ? { wifiEnforcementMode: enforcementMode } : {})
      }
    });

    const roleLabel =
      role === "PRIMARY"
        ? "Ana Şube Modemi (BSSID)"
        : role === "BACKUP"
        ? "Yedek / Yan Dükkan Modemi (İkincil BSSID)"
        : "Modem BSSID Kaydı Kaldırıldı";

    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: `${roleLabel} atandı (${normBssid})`,
        target: `${updated.code} · ${updated.name}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    sseHub.broadcast({
      type: "BRANCH_WIFI_ASSIGNED",
      title: `Şube Modem BSSID Tanımlandı`,
      message: `${updated.name} (${updated.code}) → ${normBssid} (${roleLabel})`,
      severity: "ok",
      data: {
        branchCode: updated.code,
        wifiBssid: updated.wifiBssid,
        backupWifiBssids: updated.backupWifiBssids,
        wifiEnforcementMode: updated.wifiEnforcementMode
      }
    });

    return NextResponse.json({
      status: "success",
      message: `${updated.name} şubesine ${normBssid} adresi "${roleLabel}" olarak tanımlandı.`,
      branch: {
        code: updated.code,
        name: updated.name,
        wifi: updated.wifiSsid,
        wifiBssid: updated.wifiBssid,
        backupWifiBssids: updated.backupWifiBssids,
        wifiEnforcementMode: updated.wifiEnforcementMode
      }
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "BSSID şubeye atanamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}
