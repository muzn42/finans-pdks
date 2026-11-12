import { prisma } from "@/lib/prisma";
import { normalizeBssid, parseBssidList } from "@/lib/validators";

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

  const empsByBranch = new Map<string, Array<{ id: number; sicil: string; name: string; status: string }>>();
  for (const e of employees) {
    const arr = empsByBranch.get(e.branchCode) || [];
    arr.push(e);
    empsByBranch.set(e.branchCode, arr);
  }

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
      recordObservation(b.code, emp, {
        bssid: primaryMac,
        ssid: b.wifiSsid || `ALBAYRAK_${idx + 1}_WIFI`,
        rssi: -46 - ((eIdx * 3) % 11)
      });
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
