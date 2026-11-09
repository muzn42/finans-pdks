import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE_URL = "https://albayrakfinans.com.tr/api/branches/all";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlbayrakPDKS-Scraper/1.0";

const GM = {
  name: "Albayrak Finans Genel Müdürlük (Ataşehir)",
  code: "ŞB-001",
  city: "İstanbul",
  district: "Ataşehir",
  address:
    "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul",
  phone: "444 88 61",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=40.995454,29.140893",
  lat: 40.995454,
  lng: 29.140893,
  wifi: "ALBAYRAK_GM_SECURE"
};

interface RawBranch {
  name?: string;
  title?: string;
  address?: string;
  spot?: string;
  province?: string;
  district?: string;
  phone?: string;
  googleRoadUrl?: string;
  googleMapUrl?: string;
}

interface ScrapedBranch {
  code: string;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  googleMapUrl: string;
  lat: number;
  lng: number;
  radius: number;
  wifi: string;
}

function extractCoords(text: string): { lat: number; lng: number } | null {
  const at = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const dest = text.match(/3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dest) return { lat: Number(dest[1]), lng: Number(dest[2]) };
  return null;
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase("tr-TR").trim();
}

/** "ADANA" -> "Adana", "KAHRAMANMARAŞ" -> "Kahramanmaraş" */
function cityFrom(raw: unknown): string {
  const s = cleanText(raw).toLocaleLowerCase("tr-TR");
  return s ? s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1) : "";
}

/** Kaynak ilçe alanı "Seyhan Şube" biçiminde gelir; şube ekini ayıkla. */
function districtFrom(raw: unknown): string {
  return cleanText(raw)
    .replace(/\s+Şube\b.*$/i, "")
    .trim();
}

function nextCodeFrom(existingCodes: Set<string>): () => string {
  let n = 2;
  for (const code of existingCodes) {
    const m = code.match(/(\d+)$/);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return () => {
    let code = `ŞB-${String(n).padStart(3, "0")}`;
    while (existingCodes.has(code)) {
      n += 1;
      code = `ŞB-${String(n).padStart(3, "0")}`;
    }
    existingCodes.add(code);
    n += 1;
    return code;
  };
}

export async function POST(req: NextRequest) {
  let rawBranches: RawBranch[];
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      throw new Error(`Kaynak HTTP ${res.status}`);
    }
    const json = await res.json();
    rawBranches = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    if (!rawBranches.length) throw new Error("Kaynak boş şube listesi döndürdü");
  } catch (err) {
    // Zarif geri dönüş: canlı kaynak erişilemezse mevcut DB kayıtları korunur.
    return NextResponse.json(
      {
        status: "error",
        message:
          "Canlı şube kaynağına ulaşılamadı. Mevcut PostgreSQL kayıtları değiştirilmedi.",
        detail: String(err)
      },
      { status: 502 }
    );
  }

  try {
    const existing = await prisma.branch.findMany({ orderBy: { id: "asc" } });
    const byName = new Map(existing.map((b) => [normalizeName(b.name), b]));
    const existingCodes = new Set(existing.map((b) => b.code));
    const allocateCode = nextCodeFrom(existingCodes);

    const scraped: ScrapedBranch[] = [];
    const usedCodes = new Set<string>();

    // 1. Genel Müdürlük her zaman sabit
    scraped.push({ ...GM, radius: 30 });
    usedCodes.add(GM.code);

    rawBranches.forEach((raw) => {
      const name = cleanText(raw.name || raw.title);
      if (!name) return;
      const address = cleanText(raw.address || raw.spot);
      const city = cityFrom(raw.province) || "Türkiye";
      const coords = extractCoords(
        `${raw.googleRoadUrl || ""} ${raw.googleMapUrl || ""}`
      );

      const match = byName.get(normalizeName(name));
      let code = match?.code;
      if (!code || usedCodes.has(code)) code = allocateCode();
      usedCodes.add(code);

      let lat = coords ? coords.lat : match ? match.lat : null;
      let lng = coords ? coords.lng : match ? match.lng : null;
      if (lat == null || lng == null) {
        const idx = usedCodes.size;
        lat = 40.995454 + ((idx % 15) * 0.008);
        lng = 29.140893 + ((idx % 15) * 0.008);
      }

      let wifi = match?.wifiSsid;
      if (!wifi) {
        const numeric = code.match(/(\d+)$/);
        const idx = numeric ? Number(numeric[1]) : usedCodes.size;
        wifi = `ALBAYRAK_${String(idx).padStart(2, "0")}_WIFI`;
      }

      scraped.push({
        code,
        name,
        city,
        district:
          districtFrom(raw.district) ||
          match?.district ||
          city,
        address: address || match?.address || name,
        phone: cleanText(raw.phone) || match?.phone || "444 88 61",
        googleMapUrl:
          cleanText(raw.googleMapUrl) ||
          cleanText(raw.googleRoadUrl) ||
          match?.googleMapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        radius: 30,
        wifi
      });
    });

    // 2. PostgreSQL upsert + değişiklik tespiti
    const added: string[] = [];
    const updated: string[] = [];
    let unchanged = 0;

    for (const s of scraped) {
      const prev = existing.find((b) => b.code === s.code);
      if (!prev) {
        await prisma.branch.create({
          data: {
            code: s.code,
            name: s.name,
            city: s.city,
            district: s.district || "",
            address: s.address || "",
            phone: s.phone || "444 88 61",
            googleMapUrl: s.googleMapUrl || "",
            lat: s.lat,
            lng: s.lng,
            radiusMeters: s.radius,
            wifiSsid: s.wifi,
            weight: s.code === GM.code ? 0.16 : 0.01585
          }
        });
        added.push(`${s.code} · ${s.name}`);
        continue;
      }

      const changed =
        prev.name !== s.name ||
        prev.city !== s.city ||
        (prev.district || "") !== (s.district || "") ||
        (prev.address || "") !== (s.address || "") ||
        prev.phone !== s.phone ||
        Math.abs(prev.lat - s.lat) > 0.000001 ||
        Math.abs(prev.lng - s.lng) > 0.000001 ||
        prev.radiusMeters !== s.radius ||
        prev.wifiSsid !== s.wifi;

      if (!changed) {
        unchanged += 1;
        continue;
      }

      await prisma.branch.update({
        where: { code: s.code },
        data: {
          name: s.name,
          city: s.city,
          district: s.district || "",
          address: s.address || "",
          phone: s.phone || "444 88 61",
          googleMapUrl: s.googleMapUrl || prev.googleMapUrl,
          lat: s.lat,
          lng: s.lng,
          radiusMeters: s.radius,
          wifiSsid: s.wifi
        }
      });
      updated.push(`${s.code} · ${s.name}`);
    }

    // 3. public/assets/branches.json önbelleğini güncelle (Android/Room ve seed kaynağı)
    try {
      const cacheRows = await prisma.branch.findMany({ orderBy: { id: "asc" } });
      const payload = cacheRows.map((b) => ({
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
        w: b.weight
      }));
      const target = path.join(process.cwd(), "public", "assets", "branches.json");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(payload, null, 2), "utf-8");
    } catch {
      // Önbellek yazılamazsa DB güncellemesi yine geçerli
    }

    await prisma.auditLog.create({
      data: {
        actorName: "BT Yönetimi",
        actorRole: "IT",
        action: "Web'den canlı şube senkronizasyonu çalıştırıldı",
        target: `+${added.length} yeni · ${updated.length} güncel · ${unchanged} değişmedi`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
      }
    });

    return NextResponse.json({
      status: "success",
      message: `Canlı kaynaktan ${scraped.length} şube alındı: ${added.length} eklendi, ${updated.length} güncellendi, ${unchanged} değişmedi.`,
      total: scraped.length,
      added,
      updated,
      unchanged
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: "Şube senkronizasyonu tamamlanamadı; mevcut kayıtlar korundu.",
        detail: String(err)
      },
      { status: 500 }
    );
  }
}
