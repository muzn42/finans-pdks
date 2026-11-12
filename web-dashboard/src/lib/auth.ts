import { NextRequest } from "next/server";

const SECRET_STR = process.env.JWT_SECRET;
if (!SECRET_STR && process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL: JWT_SECRET ortam değişkeni tanımlanmalıdır!");
}
const ACTIVE_SECRET =
  SECRET_STR || "albayrak-finans-pdks-dev-local-jwt-secret-key-2026-min32bytes";

export const AUTH_COOKIE_NAME = "atf_pdks_token";

/** PBKDF2-SHA256 iterasyon sayısı (OWASP 2023 önerisi: ≥ 210.000). */
const PBKDF2_ITERATIONS = 210_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Zamanlama saldırılarına karşı sabit süreli karşılaştırma. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function pbkdf2Hex(password: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Parolayı rastgele tuzlu PBKDF2-SHA256 ile özetler: `pbkdf2$<iter>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hashHex = await pbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

async function legacySha256(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
  return `sha256$${salt}$${bytesToHex(new Uint8Array(digest))}`;
}

/**
 * Parolayı doğrular. Desteklenen biçimler:
 * - `pbkdf2$…` (güncel)
 * - `sha256$…` (eski seed biçimi; başarılı girişte {@link needsRehash} ile yükseltilir)
 * Düz metin parola kayıtları artık kabul edilmez.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  const parts = storedHash.split("$");

  if (parts[0] === "pbkdf2" && parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    const actual = await pbkdf2Hex(password, parts[2], iterations);
    return timingSafeEqualStr(actual, parts[3]);
  }

  if (parts[0] === "sha256" && parts.length === 3) {
    const expected = await legacySha256(password, parts[1]);
    return timingSafeEqualStr(expected, storedHash);
  }

  return false;
}

/** Kayıt eski/zayıf biçimdeyse true döner (girişte yeniden özetlenmeli). */
export function needsRehash(storedHash: string): boolean {
  const parts = storedHash.split("$");
  return parts[0] !== "pbkdf2" || Number(parts[1]) < PBKDF2_ITERATIONS;
}

export interface JwtUserPayload {
  id: string;
  email: string;
  role: "HR" | "IT" | "ADMIN" | "DEPT_MANAGER" | "PERSONNEL";
  name: string;
  title: string;
  branch: string;
  managedDept?: string | null;
  employeeSicil?: string | null;
  perms: string[];
  iat?: number;
  exp?: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(ACTIVE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwtToken(payload: JwtUserPayload): Promise<string> {
  const enc = new TextEncoder();
  const nowSec = Math.floor(Date.now() / 1000);
  const headerB64 = toBase64Url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const bodyB64 = toBase64Url(
    enc.encode(
      JSON.stringify({
        ...payload,
        iat: nowSec,
        exp: nowSec + 60 * 60 * 12
      })
    )
  );
  const signingInput = `${headerB64}.${bodyB64}`;
  const key = await getHmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${signingInput}.${sigB64}`;
}

export async function verifyJwtToken(token: string): Promise<JwtUserPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await getHmacKey();
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      enc.encode(`${headerB64}.${bodyB64}`)
    );
    if (!valid) return null;
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(bodyB64))) as JwtUserPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function getRequestUser(req: NextRequest): Promise<JwtUserPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyJwtToken(token);
    if (verified) return verified;
  }
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifyJwtToken(cookieToken);
  }
  return null;
}

export const PERM_CATALOG = {
  HR: [
    { k: "emp_view", l: "Personel & Yoklama Görüntüleme", d: "Tüm şube personel listesi ve günlük giriş-çıkış kayıtları" },
    { k: "emp_add", l: "İşe Giriş / Yeni Personel Ekleme", d: "İşe yeni başlayan personelleri PDKS sistemine kaydetme ve sicil açma" },
    { k: "leave_manage", l: "İzin, Vardiya & Saatlik İzin Onaylama", d: "Yıllık izin, sağlık raporu, mazeret ve saatlik izin taleplerini onaylama" },
    { k: "analytics_view", l: "Ek Mesai & Net Bakiye Analitiği", d: "Departman kıyaslamaları, gecikme ve mesai lig tabloları" },
    { k: "excel_export", l: "Kurumsal Excel (.xlsx) & PDF Raporlama", d: "A4 dikey puantaj ve performans raporlarını dışa aktarma" }
  ],
  IT: [
    { k: "sec_radar", l: "30m Geofence & Sahte GPS Radarı", d: "Şube sınırı ihlallerini ve sahte konum denemelerini izleme" },
    { k: "device_manage", l: "Tek Cihaz Eşleme & Engelleme", d: "Personel mobil cihaz eşlemesini sıfırlama veya engelleme" },
    { k: "support_reset", l: "Hesap Kilidi & Geçici Parola", d: "Kilitlenen hesapları açma ve tek kullanımlık parola üretme" },
    { k: "branch_geofence", l: "Şube & 30m Geofence Tanımlama", d: "Yeni şube koordinatı, yarıçap ve kurumsal Wi-Fi ekleme" },
    { k: "audit_view", l: "Denetim Günlüğü (Audit Log)", d: "Tüm yönetici işlemlerinin değiştirilemez kayıtlarını inceleme" }
  ]
} as const;
