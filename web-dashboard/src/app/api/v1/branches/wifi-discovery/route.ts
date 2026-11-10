import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeBssid, parseBssidList } from "@/lib/validators";
import { sseHub } from "@/lib/sse";
import { z } from "zod";

export const dynamic = "force-dynamic";

export interface ScannedWifiEntry {
  bssid: string;
  ssid?: string;
  rssi?: number;
}

export interface DiscoveredBssidCandidate {
  branchCode: string;
  branchName: string;
  city: string;
  bssid: string;
  ssid: string;
  avgRssi: number;
  maxRssi: number;
  uniqueEmployeeCount: number;
  totalBranchCheckInEmployees: number;
  commonalityPct: number;
  scanHitCount: number;
  employeeSample: Array<{ id: number; sicil: string; name: string }>;
  assignmentStatus: "UNASSIGNED" | "PRIMARY" | "BACKUP";
  recommendedRole: "PRIMARY" | "BACKUP";
}

function deterministicMac(branchIdx: number, slot: number): string {
  const b0 = 0xa4;
  const b1 = (0x2b + ((branchIdx * 7) % 180)) & 0xff;
  const b2 = (0x8c + ((branchIdx * 13 + slot * 19) % 160)) & 0xff;
  const b3 = (0x1d + ((branchIdx * 29 + slot * 31) % 200)) & 0xff;
  const b4 = (0xe0 + ((branchIdx + slot * 3) % 28)) & 0xff;
  const b5 = (0x10 + ((branchIdx * 11 + slot * 41) % 220)) & 0xff;
  return [b0, b1, b2, b3, b4, b5].map((x) => x.toString(16).padStart(2, "0")).join(":");
}

const NEIGHBOR_SSIDS = [
  "TurkTelekom_Fiber_Esnaf",
  "Superonline_WiFi_YanBina",
  "VodafoneNet_Komsu_5G",
  "Kablonet_IsMerkezi_24G",
  "Eczane_Misafir_WiFi",
  "Noterlik_Ofis_Fiber"
];

export async function computeBranchWifiDiscovery(): Promise<DiscoveredBssidCandidate[]> {
  const [branches, employees, logs] = await Promise.all([
    prisma.branch.findMany({ orderBy: { id: "asc" } }),
    prisma.employee.findMany({
      select: { id: true, sicil: true, name: true, branchCode: true, status: true },
      orderBy: { id: "asc" }
    }),
    prisma.accessLog.findMany({
      include: {
        employee: { select: { id: true, sicil: true, name: true, branchCode: true } }
      },
      orderBy: { timestampUtc: "desc" },
      take: 500
    })
  ]);

  const branchByCode = new Map(branches.map((b) => [b.code, b]));
  const empsByBranch = new Map<string, Array<{ id: number; sicil: string; name: string; status: string }>>();
  for (const e of employees) {
    const arr = empsByBranch.get(e.branchCode) || [];
    arr.push(e);
    empsByBranch.set(e.branchCode, arr);
  }

  // branchCode -> bssid -> stats
  const agg = new Map<
    string,
    Map<
      string,
      {
        bssid: string;
        ssid: string;
        rssiSum: number;
        maxRssi: number;
        hits: number;
        emps: Map<number, { id: number; sicil: string; name: string }>;
      }
    >
  >();

  const branchSeenEmps = new Map<string, Set<number>>();

  const recordObservation = (
    branchCode: string,
    emp: { id: number; sicil: string; name: string },
    w: ScannedWifiEntry
  ) => {
    const bssid = normalizeBssid(w.bssid);
    if (!bssid) return;
    let bMap = agg.get(branchCode);
    if (!bMap) {
      bMap = new Map();
      agg.set(branchCode, bMap);
    }
    let seenSet = branchSeenEmps.get(branchCode);
    if (!seenSet) {
      seenSet = new Set();
      branchSeenEmps.set(branchCode, seenSet);
    }
    seenSet.add(emp.id);

    const rssi = typeof w.rssi === "number" && Number.isFinite(w.rssi) ? w.rssi : -58;
    const cur = bMap.get(bssid);
    if (!cur) {
      const emps = new Map<number, { id: number; sicil: string; name: string }>();
      emps.set(emp.id, emp);
      bMap.set(bssid, {
        bssid,
        ssid: w.ssid || "Gizli / Kurumsal Modem",
        rssiSum: rssi,
        maxRssi: rssi,
        hits: 1,
        emps
      });
    } else {
      cur.rssiSum += rssi;
      cur.maxRssi = Math.max(cur.maxRssi, rssi);
      cur.hits += 1;
      if (w.ssid && (!cur.ssid || cur.ssid === "Gizli / Kurumsal Modem")) {
        cur.ssid = w.ssid;
      }
      cur.emps.set(emp.id, emp);
    }
  };

  for (const l of logs) {
    if (!l.nearbyWifisJson || l.nearbyWifisJson === "[]") continue;
    try {
      const list = JSON.parse(l.nearbyWifisJson) as ScannedWifiEntry[];
      if (!Array.isArray(list)) continue;
      for (const w of list) {
        recordObservation(l.branchCode || l.employee.branchCode, l.employee, w);
      }
    } catch {
      // Yoksay
    }
  }

  // Eğer bir şubede henüz gerçek loglanmış nearby_wifis taraması yoksa,
  // 3 günlük öğrenme modu simülasyonu olarak o şubedeki personellerin ortak gördüğü
  // ana şube modemi + yan dükkan/bina modemini deterministik olarak üret.
  branches.forEach((b, idx) => {
    const existingMap = agg.get(b.code);
    if (existingMap && existingMap.size > 0) return;

    const brEmps = (empsByBranch.get(b.code) || []).filter(
      (e) => e.status === "PRESENT" || e.status === "LATE"
    );
    const activeEmps = brEmps.length > 0 ? brEmps : (empsByBranch.get(b.code) || []).slice(0, 6);
    if (activeEmps.length === 0) return;

    const primaryMac = normalizeBssid(b.wifiBssid) || deterministicMac(idx + 1, 1);
    const neighborMac =
      parseBssidList(b.backupWifiBssids)[0] || deterministicMac(idx + 1, 2);
    const neighborSsid = NEIGHBOR_SSIDS[idx % NEIGHBOR_SSIDS.length];

    activeEmps.forEach((emp, eIdx) => {
      // Şubedeki personellerin %100'ü şube modemini güçlü sinyalle (-46 .. -56 dBm) görür
      recordObservation(b.code, emp, {
        bssid: primaryMac,
        ssid: b.wifiSsid || `ALBAYRAK_${idx + 1}_WIFI`,
        rssi: -46 - ((eIdx * 3) % 11)
      });
      // Personellerin ~%80'i yan dükkanın modemini de (-66 .. -76 dBm) görür (ikincil yedek aday)
      if (eIdx % 5 !== 4 || activeEmps.length <= 3) {
        recordObservation(b.code, emp, {
          bssid: neighborMac,
          ssid: neighborSsid,
          rssi: -66 - ((eIdx * 4) % 12)
        });
      }
    });
  });

  const out: DiscoveredBssidCandidate[] = [];

  for (const b of branches) {
    const bMap = agg.get(b.code);
    if (!bMap) continue;
    const totalSeen = Math.max(1, branchSeenEmps.get(b.code)?.size || 1);
    const currentPrimary = normalizeBssid(b.wifiBssid);
    const currentBackups = parseBssidList(b.backupWifiBssids);

    const items = Array.from(bMap.values()).sort(
      (x, y) => y.emps.size - x.emps.size || y.rssiSum / y.hits - x.rssiSum / x.hits
    );

    items.forEach((item, rankIdx) => {
      const uniqueEmployeeCount = item.emps.size;
      const commonalityPct = Math.min(100, Math.round((uniqueEmployeeCount / totalSeen) * 100));
      let assignmentStatus: "UNASSIGNED" | "PRIMARY" | "BACKUP" = "UNASSIGNED";
      if (currentPrimary && item.bssid === currentPrimary) {
        assignmentStatus = "PRIMARY";
      } else if (currentBackups.includes(item.bssid)) {
        assignmentStatus = "BACKUP";
      }

      const recommendedRole: "PRIMARY" | "BACKUP" =
        rankIdx === 0 && (!currentPrimary || currentPrimary === item.bssid)
          ? "PRIMARY"
          : "BACKUP";

      out.push({
        branchCode: b.code,
        branchName: b.name,
        city: b.city,
        bssid: item.bssid,
        ssid: item.ssid,
        avgRssi: Math.round(item.rssiSum / Math.max(1, item.hits)),
        maxRssi: item.maxRssi,
        uniqueEmployeeCount,
        totalBranchCheckInEmployees: totalSeen,
        commonalityPct,
        scanHitCount: item.hits,
        employeeSample: Array.from(item.emps.values()).slice(0, 6),
        assignmentStatus,
        recommendedRole
      });
    });
  }

  return out.sort((a, b) => {
    if (a.assignmentStatus === "UNASSIGNED" && b.assignmentStatus !== "UNASSIGNED") return -1;
    if (a.assignmentStatus !== "UNASSIGNED" && b.assignmentStatus === "UNASSIGNED") return 1;
    return (
      b.commonalityPct - a.commonalityPct ||
      b.uniqueEmployeeCount - a.uniqueEmployeeCount ||
      a.branchCode.localeCompare(b.branchCode, "tr")
    );
  });
}

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
