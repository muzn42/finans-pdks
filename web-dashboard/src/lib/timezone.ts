/**
 * Timezone & Duration Utilities
 * Veritabanında tüm zaman damgaları UTC (ISO-8601 TIMESTAMPTZ) olarak tutulur,
 * ön yüzde ve raporlarda Europe/Istanbul (GMT+3) saat dilimine çevrilir.
 */

export const ISTANBUL_TZ = "Europe/Istanbul";

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function toIstanbulTime(utcInput: Date | string | number | null | undefined): string {
  if (!utcInput) return "—";
  const d = utcInput instanceof Date ? utcInput : new Date(utcInput);
  if (Number.isNaN(d.getTime())) return "—";
  return timeFormatter.format(d);
}

export function toIstanbulDateTime(utcInput: Date | string | number | null | undefined): string {
  if (!utcInput) return "—";
  const d = utcInput instanceof Date ? utcInput : new Date(utcInput);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

export function toIstanbulDate(utcInput: Date | string | number | null | undefined): string {
  if (!utcInput) return "—";
  const d = utcInput instanceof Date ? utcInput : new Date(utcInput);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function hhmmFromMin(min: number | null | undefined): string | null {
  if (min == null || !Number.isFinite(min)) return null;
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

export function minFromHhmm(hhmm: string | null | undefined): number | null {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
  const [hStr, mStr] = hhmm.trim().split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

export function fmtDurMin(min: number): string {
  if (!Number.isFinite(min)) return "0 dk";
  const sign = min < 0 ? "-" : min > 0 ? "+" : "";
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} dk`;
  if (m === 0) return `${sign}${h} sa`;
  return `${sign}${h} sa ${m} dk`;
}

export function nowUtc(): Date {
  return new Date();
}
