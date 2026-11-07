import { fmtDurMin, hhmmFromMin, minFromHhmm, pad2 } from "./timezone";

export interface WorkDayMeta {
  idx: number;
  iso: string;
  date: string;
  fullDate: string;
  dow: number;
  dowName: string;
  dowShort: string;
  present: number;
  late: number;
  leave: number;
  absent: number;
  avgInMin: number;
  avgOutMin: number;
  overtimeHours: number;
  lateTotalMin: number;
}

export interface DailyLogEntry {
  dayIdx: number;
  iso: string;
  date: string;
  fullDate: string;
  dow: number;
  dowName: string;
  dowShort: string;
  status: "PRESENT" | "LATE" | "LEAVE" | "ABSENT";
  inMin: number | null;
  outMin: number | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMin: number;
  lateMin: number;
  overtimeMin: number;
  netDayMin: number;
  dist: number;
}

export interface WeekdayStat {
  dow: number;
  name: string;
  short: string;
  totalDays: number;
  presentDays: number;
  lateCount: number;
  lateMin: number;
  avgLateWhenLate: number;
  overtimeCount: number;
  overtimeMin: number;
  avgOvertimeWhenOt: number;
  workedMin: number;
  avgWorkHours: number;
  netMin: number;
  avgIn: string;
  avgOut: string;
}

export interface EmployeeDeepAnalytics {
  empId: number;
  periodDays: number;
  startDate: string;
  endDate: string;
  presentDays: number;
  onTimeDays: number;
  lateDays: number;
  leaveDays: number;
  absentDays: number;
  attendanceRate: number;
  punctualityRate: number;
  totalLateMin: number;
  totalOvertimeMin: number;
  netBalanceMin: number;
  netBalanceHours: number;
  overtimeHours: number;
  lateHours: number;
  netPositiveRatio: number;
  totalWorkedMin: number;
  avgDailyHours: number;
  avgIn: string;
  avgOut: string;
  avgDist: number;
  maxDist: number;
  geofenceComplianceRate: number;
  earliestInRec: DailyLogEntry | null;
  latestInRec: DailyLogEntry | null;
  latestOutRec: DailyLogEntry | null;
  mostLateDay: WeekdayStat;
  mostOvertimeDay: WeekdayStat;
  bestNetDay: WeekdayStat;
  peakLateRec: DailyLogEntry | null;
  peakOvertimeRec: DailyLogEntry | null;
  weekdayStats: WeekdayStat[];
  dailyLogs: DailyLogEntry[];
}

function createRng(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v: number, a: number, b: number): number {
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a;
}

const DOW_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const DOW_SHORT = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const WORK_DAYS_60: WorkDayMeta[] = (() => {
  const d = new Date(2026, 9, 20);
  let guard = 0;
  const out: Date[] = [];
  while (out.length < 60 && guard++ < 140) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) out.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse().map((dt, i) => {
    const dow = dt.getDay();
    const yyyy = dt.getFullYear();
    const mm = pad2(dt.getMonth() + 1);
    const dd = pad2(dt.getDate());
    const iso = `${yyyy}-${mm}-${dd}`;
    const r = createRng(yyyy * 400 + (dt.getMonth() + 1) * 40 + dt.getDate());
    const base =
      0.925 +
      0.012 * Math.sin(i / 4) -
      (dow === 1 ? 0.03 : dow === 5 ? 0.018 : 0) +
      (r() - 0.5) * 0.02;
    const late = clamp(1 - base - 0.045 - 0.012, 0.015, 0.14);
    const absent = 0.014 + r() * 0.014;
    const leave = 0.028 + r() * 0.02;
    return {
      idx: i,
      iso,
      date: `${dd}.${mm}`,
      fullDate: `${dd}.${mm}.${yyyy}`,
      dow,
      dowName: DOW_NAMES[dow],
      dowShort: DOW_SHORT[dow],
      present: +(1 - late - absent - leave).toFixed(3),
      late: +late.toFixed(3),
      leave: +leave.toFixed(3),
      absent: +absent.toFixed(3),
      avgInMin: Math.round(8 * 60 + 28 + (dow === 1 ? 7 : 0) + (r() - 0.4) * 8),
      avgOutMin: Math.round(17 * 60 + 42 + (r() - 0.3) * 14),
      overtimeHours: Math.round(62 + r() * 48),
      lateTotalMin: Math.round(310 + (dow === 1 ? 140 : 0) + r() * 190)
    };
  });
})();

export function getDaysInRange(opts?: {
  rangeDays?: number;
  fromIso?: string | null;
  toIso?: string | null;
}): WorkDayMeta[] {
  const { rangeDays = 30, fromIso, toIso } = opts || {};
  if (fromIso || toIso) {
    const start = fromIso || "0000-00-00";
    const end = toIso || "9999-99-99";
    const filtered = WORK_DAYS_60.filter((d) => d.iso >= start && d.iso <= end);
    if (filtered.length > 0) return filtered;
  }
  const n = clamp(Number(rangeDays) || 30, 1, WORK_DAYS_60.length);
  return WORK_DAYS_60.slice(-n);
}

export function buildDailyLogsForEmployee(emp: {
  id: number;
  sicil: string;
  status: string;
  inMin?: number | null;
  outMin?: number | null;
  lateMin?: number;
  overtimeMin?: number;
  distMeters?: number;
  shiftStartMin?: number;
  shiftEndMin?: number;
}): DailyLogEntry[] {
  const empSeed = hashStr(`${emp.sicil}|${emp.id}`);
  const er = createRng(empSeed);
  const shiftStart = emp.shiftStartMin ?? 510;
  const shiftEnd = emp.shiftEndMin ?? 1050;
  const favLateDow = [1, 1, 5, 2, 4, 3][emp.id % 6];
  const favOtDow = [2, 3, 4, 1, 5][emp.id % 5];
  const punctualityTrait = 0.04 + (emp.id % 9) * 0.022;
  const overtimeTrait = 0.22 + ((emp.id * 7) % 11) * 0.048;

  return WORK_DAYS_60.map((day, idx) => {
    const isLastDay = idx === WORK_DAYS_60.length - 1;
    const r = er();
    let status: "PRESENT" | "LATE" | "LEAVE" | "ABSENT" = "PRESENT";
    let inMin: number | null = null;
    let outMin: number | null = null;
    let lateMin = 0;
    let overtimeMin = 0;
    let workedMin = 0;
    let dist = +(3.2 + er() * 19.5).toFixed(1);

    if (isLastDay) {
      status = (emp.status as "PRESENT" | "LATE" | "LEAVE" | "ABSENT") || "PRESENT";
      inMin = emp.inMin ?? (status === "PRESENT" ? shiftStart - 5 : status === "LATE" ? shiftStart + 25 : null);
      outMin = emp.outMin ?? (status === "PRESENT" || status === "LATE" ? shiftEnd + 15 : null);
      lateMin = emp.lateMin ?? 0;
      overtimeMin = emp.overtimeMin ?? 0;
      workedMin = inMin != null && outMin != null ? Math.max(0, outMin - inMin - 60) : 0;
      dist = emp.distMeters ?? dist;
    } else {
      const dowLateBoost = day.dow === favLateDow ? 0.16 : day.dow === 1 ? 0.05 : 0;
      const dowOtBoost = day.dow === favOtDow ? 0.24 : 0;
      if (r < 0.028) {
        status = "LEAVE";
      } else if (r < 0.04) {
        status = "ABSENT";
        dist = +(35 + er() * 65).toFixed(1);
      } else if (r < 0.04 + punctualityTrait + dowLateBoost) {
        status = "LATE";
        const extraLate =
          day.dow === favLateDow ? 16 + Math.floor(er() * 38) : 6 + Math.floor(er() * 26);
        lateMin = extraLate;
        inMin = shiftStart + 5 + extraLate;
      } else {
        status = "PRESENT";
        inMin = shiftStart - 15 + Math.floor(er() * 19);
      }

      if (status === "PRESENT" || status === "LATE") {
        const otRoll = er();
        if (otRoll < overtimeTrait + dowOtBoost) {
          const otExtra =
            day.dow === favOtDow ? 35 + Math.floor(er() * 95) : 15 + Math.floor(er() * 65);
          overtimeMin = otExtra;
          outMin = shiftEnd + otExtra;
        } else {
          outMin = shiftEnd - 5 + Math.floor(er() * 14);
        }
        workedMin = Math.max(0, (outMin ?? shiftEnd) - (inMin ?? shiftStart) - 60);
      }
    }

    return {
      dayIdx: idx,
      iso: day.iso,
      date: day.date,
      fullDate: day.fullDate,
      dow: day.dow,
      dowName: day.dowName,
      dowShort: day.dowShort,
      status,
      inMin,
      outMin,
      checkIn: hhmmFromMin(inMin),
      checkOut: hhmmFromMin(outMin),
      workedMin,
      lateMin,
      overtimeMin,
      netDayMin: overtimeMin - lateMin,
      dist
    };
  });
}

export function getEmployeeAnalytics(
  emp: {
    id: number;
    sicil: string;
    status: string;
    inMin?: number | null;
    outMin?: number | null;
    lateMin?: number;
    overtimeMin?: number;
    distMeters?: number;
    shiftStartMin?: number;
    shiftEndMin?: number;
  },
  opts?: { rangeDays?: number; fromIso?: string | null; toIso?: string | null }
): EmployeeDeepAnalytics {
  const days = getDaysInRange(opts);
  const isoSet = new Set(days.map((d) => d.iso));
  const allLogs = buildDailyLogsForEmployee(emp);
  const logs = allLogs.filter((l) => isoSet.has(l.iso));

  let presentDays = 0;
  let onTimeDays = 0;
  let lateDays = 0;
  let leaveDays = 0;
  let absentDays = 0;
  let totalLateMin = 0;
  let totalOvertimeMin = 0;
  let totalWorkedMin = 0;
  let inSum = 0;
  let inCount = 0;
  let outSum = 0;
  let outCount = 0;
  let distSum = 0;
  let distCount = 0;
  let maxDist = 0;
  let compliantDistCount = 0;
  let peakLateRec: DailyLogEntry | null = null;
  let peakOvertimeRec: DailyLogEntry | null = null;
  let earliestInRec: DailyLogEntry | null = null;
  let latestInRec: DailyLogEntry | null = null;
  let latestOutRec: DailyLogEntry | null = null;

  const byDow: Record<
    number,
    {
      dow: number;
      name: string;
      short: string;
      totalDays: number;
      presentDays: number;
      lateCount: number;
      lateMin: number;
      overtimeCount: number;
      overtimeMin: number;
      workedMin: number;
      inSum: number;
      inCount: number;
      outSum: number;
      outCount: number;
    }
  > = {};

  for (let d = 1; d <= 5; d++) {
    byDow[d] = {
      dow: d,
      name: DOW_NAMES[d],
      short: DOW_SHORT[d],
      totalDays: 0,
      presentDays: 0,
      lateCount: 0,
      lateMin: 0,
      overtimeCount: 0,
      overtimeMin: 0,
      workedMin: 0,
      inSum: 0,
      inCount: 0,
      outSum: 0,
      outCount: 0
    };
  }

  for (const l of logs) {
    const b = byDow[l.dow];
    if (b) b.totalDays++;

    if (l.status === "PRESENT") {
      presentDays++;
      onTimeDays++;
      if (b) b.presentDays++;
    } else if (l.status === "LATE") {
      presentDays++;
      lateDays++;
      if (b) {
        b.presentDays++;
        b.lateCount++;
        b.lateMin += l.lateMin;
      }
      totalLateMin += l.lateMin;
      if (!peakLateRec || l.lateMin > peakLateRec.lateMin) peakLateRec = l;
    } else if (l.status === "LEAVE") {
      leaveDays++;
    } else if (l.status === "ABSENT") {
      absentDays++;
    }

    if (l.overtimeMin > 0) {
      totalOvertimeMin += l.overtimeMin;
      if (b) {
        b.overtimeCount++;
        b.overtimeMin += l.overtimeMin;
      }
      if (!peakOvertimeRec || l.overtimeMin > peakOvertimeRec.overtimeMin) {
        peakOvertimeRec = l;
      }
    }

    if (l.workedMin > 0) {
      totalWorkedMin += l.workedMin;
      if (b) b.workedMin += l.workedMin;
    }

    if (l.inMin != null) {
      inSum += l.inMin;
      inCount++;
      if (b) {
        b.inSum += l.inMin;
        b.inCount++;
      }
      if (!earliestInRec || l.inMin < (earliestInRec.inMin ?? 9999)) earliestInRec = l;
      if (!latestInRec || l.inMin > (latestInRec.inMin ?? 0)) latestInRec = l;
    }

    if (l.outMin != null) {
      outSum += l.outMin;
      outCount++;
      if (b) {
        b.outSum += l.outMin;
        b.outCount++;
      }
      if (!latestOutRec || l.outMin > (latestOutRec.outMin ?? 0)) latestOutRec = l;
    }

    if (l.status === "PRESENT" || l.status === "LATE") {
      const dm = Number(l.dist) || 0;
      distSum += dm;
      distCount++;
      if (dm > maxDist) maxDist = dm;
      if (dm <= 30) compliantDistCount++;
    }
  }

  const weekdayStats: WeekdayStat[] = Object.values(byDow).map((b) => {
    const netMin = b.overtimeMin - b.lateMin;
    return {
      dow: b.dow,
      name: b.name,
      short: b.short,
      totalDays: b.totalDays,
      presentDays: b.presentDays,
      lateCount: b.lateCount,
      lateMin: b.lateMin,
      avgLateWhenLate: b.lateCount > 0 ? Math.round(b.lateMin / b.lateCount) : 0,
      overtimeCount: b.overtimeCount,
      overtimeMin: b.overtimeMin,
      avgOvertimeWhenOt: b.overtimeCount > 0 ? Math.round(b.overtimeMin / b.overtimeCount) : 0,
      workedMin: b.workedMin,
      avgWorkHours: b.presentDays > 0 ? +(b.workedMin / 60 / b.presentDays).toFixed(1) : 0,
      netMin,
      avgIn: b.inCount > 0 ? hhmmFromMin(Math.round(b.inSum / b.inCount)) ?? "—" : "—",
      avgOut: b.outCount > 0 ? hhmmFromMin(Math.round(b.outSum / b.outCount)) ?? "—" : "—"
    };
  });

  const mostLateDay = weekdayStats.reduce(
    (best, cur) =>
      cur.lateMin > best.lateMin || (cur.lateMin === best.lateMin && cur.lateCount > best.lateCount)
        ? cur
        : best,
    weekdayStats[0]
  );

  const mostOvertimeDay = weekdayStats.reduce(
    (best, cur) => (cur.overtimeMin > best.overtimeMin ? cur : best),
    weekdayStats[0]
  );

  const bestNetDay = weekdayStats.reduce(
    (best, cur) => (cur.netMin > best.netMin ? cur : best),
    weekdayStats[0]
  );

  const netBalanceMin = totalOvertimeMin - totalLateMin;
  const totalAbs = totalOvertimeMin + totalLateMin;
  const netPositiveRatio = totalAbs > 0 ? Math.round((totalOvertimeMin / totalAbs) * 100) : 50;

  return {
    empId: emp.id,
    periodDays: logs.length,
    startDate: logs[0]?.fullDate ?? "—",
    endDate: logs[logs.length - 1]?.fullDate ?? "—",
    presentDays,
    onTimeDays,
    lateDays,
    leaveDays,
    absentDays,
    attendanceRate: logs.length > 0 ? +((presentDays / logs.length) * 100).toFixed(1) : 0,
    punctualityRate: presentDays > 0 ? +((onTimeDays / presentDays) * 100).toFixed(1) : 0,
    totalLateMin,
    totalOvertimeMin,
    netBalanceMin,
    netBalanceHours: +(netBalanceMin / 60).toFixed(1),
    overtimeHours: +(totalOvertimeMin / 60).toFixed(1),
    lateHours: +(totalLateMin / 60).toFixed(1),
    netPositiveRatio,
    totalWorkedMin,
    avgDailyHours: presentDays > 0 ? +(totalWorkedMin / 60 / presentDays).toFixed(1) : 0,
    avgIn: inCount > 0 ? hhmmFromMin(Math.round(inSum / inCount)) ?? "—" : "—",
    avgOut: outCount > 0 ? hhmmFromMin(Math.round(outSum / outCount)) ?? "—" : "—",
    avgDist: distCount > 0 ? +(distSum / distCount).toFixed(1) : 0,
    maxDist: +maxDist.toFixed(1),
    geofenceComplianceRate:
      distCount > 0 ? +((compliantDistCount / distCount) * 100).toFixed(1) : 100,
    earliestInRec,
    latestInRec,
    latestOutRec,
    mostLateDay,
    mostOvertimeDay,
    bestNetDay,
    peakLateRec,
    peakOvertimeRec,
    weekdayStats,
    dailyLogs: logs.slice().reverse()
  };
}

/**
 * Vardiya ve Onaylı Saatlik İzin Kurallarına Göre Giriş/Çıkış Hesaplama Motoru
 */
export function calculateAttendanceMetrics(params: {
  inMin: number | null;
  outMin: number | null;
  shiftStartMin: number;
  shiftEndMin: number;
  shiftGraceMin: number;
  shiftBreakMin: number;
  approvedHourlyLeaveMin?: number;
}): {
  status: "PRESENT" | "LATE" | "ABSENT";
  lateMin: number;
  overtimeMin: number;
  workedMin: number;
} {
  const {
    inMin,
    outMin,
    shiftStartMin,
    shiftEndMin,
    shiftGraceMin,
    shiftBreakMin,
    approvedHourlyLeaveMin = 0
  } = params;

  if (inMin == null) {
    return { status: "ABSENT", lateMin: 0, overtimeMin: 0, workedMin: 0 };
  }

  const rawLate = inMin > shiftStartMin + shiftGraceMin ? inMin - shiftStartMin : 0;
  // Onaylı saatlik izin varsa gecikme süresinden düşülür
  const effectiveLateMin = Math.max(0, rawLate - approvedHourlyLeaveMin);
  const status = effectiveLateMin > 0 ? "LATE" : "PRESENT";
  const overtimeMin = outMin != null && outMin > shiftEndMin + 10 ? outMin - shiftEndMin : 0;
  const workedMin =
    outMin != null ? Math.max(0, outMin - inMin - shiftBreakMin) : Math.max(0, 540 - effectiveLateMin);

  return { status, lateMin: effectiveLateMin, overtimeMin, workedMin };
}

export { fmtDurMin, hhmmFromMin, minFromHhmm };
