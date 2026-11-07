"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge, Button, Skeleton } from "@/components/ui/primitives";
import { usePdksStore } from "@/store/use-pdks-store";
import { fmtDurMin, hhmmFromMin } from "@/lib/timezone";

interface BootstrapResponse {
  status: string;
  serverTimeUtc: string;
  serverTimeIstanbul: string;
  branches: Array<{
    code: string;
    name: string;
    city: string;
    district?: string;
    address?: string;
    phone?: string;
    googleMapUrl?: string;
    lat: number;
    lng: number;
    radius: number;
    wifi: string;
  }>;
  shifts: Array<{
    id: number;
    code: string;
    name: string;
    startMin: number;
    endMin: number;
    breakMin: number;
    graceMin: number;
    isFlexible: boolean;
  }>;
  employees: Array<{
    id: number;
    sicil: string;
    name: string;
    dept: string;
    title: string;
    branch: string;
    shiftId: number;
    shiftName: string;
    status: string;
    inMin: number | null;
    outMin: number | null;
    checkIn: string | null;
    checkOut: string | null;
    lateMin: number;
    overtimeMin: number;
    dist: number;
    device: string;
    os: string;
    ver: string;
    bound: boolean;
    email: string;
    hireDate: string;
    leaveUsed: number;
    leaveTotal: number;
  }>;
  leaves: Array<{
    id: string;
    dbId: number;
    empId: number;
    sicil: string;
    name: string;
    dept: string;
    branch: string;
    type: string;
    isHourly: boolean;
    start: string;
    end: string;
    startClock: string | null;
    endClock: string | null;
    days: number;
    durationMin: number;
    note: string;
    status: string;
    reviewerName: string | null;
    createdAtIstanbul: string;
  }>;
  accessLogs: Array<{
    id: number;
    empId: number;
    sicil: string;
    name: string;
    dept: string;
    branch: string;
    eventType: string;
    source: string;
    distanceMeters: number;
    isMockGps: boolean;
    note: string | null;
    timestampUtc: string;
    timeIstanbul: string;
    dateIstanbul: string;
  }>;
  alerts: Array<{
    id: string;
    empId: number;
    sicil: string;
    name: string;
    dept: string;
    branch: string;
    type: string;
    sev: string;
    dist: number;
    time: string;
    status: string;
  }>;
  audits: Array<{
    time: string;
    actor: string;
    role: string;
    action: string;
    target: string;
    ip: string;
  }>;
}

interface LiveEventItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity?: "info" | "ok" | "warn" | "bad";
  timestampUtc: string;
}

const EVENT_TYPE_TR: Record<string, { label: string; tone: "ok" | "info" | "warn" }> = {
  CHECK_IN: { label: "Sabah Giriş (Check-In)", tone: "ok" },
  LUNCH_OUT: { label: "Öğle Arası Çıkış", tone: "info" },
  LUNCH_IN: { label: "Öğle Arası Dönüş", tone: "ok" },
  BREAK_OUT: { label: "Kısa Mola Çıkışı", tone: "warn" },
  BREAK_IN: { label: "Kısa Mola Dönüşü", tone: "ok" },
  CHECK_OUT: { label: "Akşam Çıkış (Check-Out)", tone: "info" }
};

export function LiveRealtimeHub() {
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "live" | "access" | "shifts_leaves" | "recharts"
  >("live");
  const [sseConnected, setSseConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([]);
  const [inApp, setInApp] = useState(false);

  // Canlı geçiş simülatörü form state
  const [simEmpId, setSimEmpId] = useState<number>(1);
  const [simEvent, setSimEvent] = useState<string>("CHECK_IN");
  const [simSource, setSimSource] = useState<string>("MOBILE_GEOFENCE");
  const [simClock, setSimClock] = useState<string>("08:28");
  const [simDist, setSimDist] = useState<number>(6.4);
  const [simMockGps, setSimMockGps] = useState<boolean>(false);
  const [simFeedback, setSimFeedback] = useState<{
    tone: "ok" | "bad";
    text: string;
  } | null>(null);

  // Saatlik / Günlük izin oluşturma form state
  const [lvEmpId, setLvEmpId] = useState<number>(1);
  const [lvType, setLvType] = useState<string>("Saatlik izin");
  const [lvDate, setLvDate] = useState<string>("20.10.2026");
  const [lvStartClock, setLvStartClock] = useState<string>("08:30");
  const [lvEndClock, setLvEndClock] = useState<string>("10:00");
  const [lvDays, setLvDays] = useState<number>(1);
  const [lvNote, setLvNote] = useState<string>(
    "Resmi kurum ve noter işlemi için sabah saatlik izin talebi."
  );

  // Yeni Vardiya şablonu form state
  const [shCode, setShCode] = useState<string>("");
  const [shName, setShName] = useState<string>("");
  const [shStart, setShStart] = useState<string>("08:30");
  const [shEnd, setShEnd] = useState<string>("17:30");
  const [shGrace, setShGrace] = useState<number>(5);

  const branchFilter = usePdksStore((s) => s.branchFilter);

  // TanStack Query ile PostgreSQL 18 Bootstrap Verisi (Yalnızca inApp veya çekmece açıkken)
  const { data, isLoading, refetch, isFetching } = useQuery<BootstrapResponse>({
    queryKey: ["pdks-bootstrap"],
    queryFn: async () => {
      const res = await fetch("/api/v1/bootstrap", { cache: "no-store" });
      if (!res.ok) throw new Error("PostgreSQL verisi alınamadı");
      return res.json();
    },
    enabled: inApp || open,
    staleTime: 15000,
    refetchOnWindowFocus: false
  });

  // Mevcut window.ATF.DATA ile çift yönlü PostgreSQL senkronizasyonu
  useEffect(() => {
    if (!data || data.status !== "success") return;
    const win = window as unknown as {
      ATF?: {
        DATA?: {
          ACCESS_LOGS?: unknown[];
          SHIFTS?: unknown[];
          syncEmployeesFromBackend?: () => void;
          clearAnalyticsCache?: () => void;
        };
      };
    };

    if (win.ATF?.DATA) {
      win.ATF.DATA.ACCESS_LOGS = data.accessLogs;
      win.ATF.DATA.SHIFTS = data.shifts;
      win.ATF.DATA.syncEmployeesFromBackend?.();
      win.ATF.DATA.clearAnalyticsCache?.();
    }
  }, [data]);

  // #authView / in-app durumunu izle
  useEffect(() => {
    const checkInApp = () => {
      setInApp(document.body.classList.contains("in-app"));
    };
    checkInApp();
    const obs = new MutationObserver(checkInApp);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Escape tuşu ile çekmeceyi kapatma (WCAG 2.2 AA Klavye Gezinimi)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Gerçek Zamanlı SSE (/api/v1/events/stream) aboneliği (Yalnızca inApp aktifken)
  useEffect(() => {
    if (!inApp && !open) return;
    const es = new EventSource("/api/v1/events/stream");
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    es.addEventListener("connected", (e) => {
      setSseConnected(true);
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        if (Array.isArray(parsed.recentEvents)) {
          setLiveEvents(parsed.recentEvents);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener("pdks_event", (e) => {
      try {
        const evt: LiveEventItem = JSON.parse((e as MessageEvent).data);
        setLiveEvents((prev) => [evt, ...prev.slice(0, 24)]);
        if (refetchTimer) clearTimeout(refetchTimer);
        refetchTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
        }, 250);

        const win = window as unknown as {
          ATF?: { toast?: (msg: string, kind?: string) => void };
        };
        if (document.body.classList.contains("in-app")) {
          win.ATF?.toast?.(
            `[Canlı] ${evt.title}: ${evt.message}`,
            evt.severity || "info"
          );
        }
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      es.close();
    };
  }, [inApp, open, queryClient]);

  // Canlı Geçiş / AccessLog Gönderme Mutasyonu
  const accessMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/access-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: simEmpId,
          eventType: simEvent,
          source: simSource,
          distanceMeters: simDist,
          isMockGps: simMockGps,
          clockHhmm: simClock
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "İşlem engellendi.");
      }
      return json;
    },
    onSuccess: (res) => {
      setSimFeedback({ tone: "ok", text: res.message });
      queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
    },
    onError: (err: Error) => {
      setSimFeedback({ tone: "bad", text: err.message });
      queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
    }
  });

  // Saatlik / Günlük İzin Oluşturma Mutasyonu
  const createLeaveMutation = useMutation({
    mutationFn: async () => {
      const isHourly = lvType === "Saatlik izin";
      const res = await fetch("/api/v1/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: lvEmpId,
          leaveType: lvType,
          isHourly,
          startDate: lvDate,
          endDate: lvDate,
          startClock: isHourly ? lvStartClock : null,
          endClock: isHourly ? lvEndClock : null,
          days: isHourly ? 0.2 : lvDays,
          note: lvNote
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "İzin oluşturulamadı.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
    }
  });

  // İzin Onay / Red Mutasyonu
  const decideLeaveMutation = useMutation({
    mutationFn: async (vars: { code: string; status: "APPROVED" | "REJECTED" }) => {
      const res = await fetch("/api/v1/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Durum güncellenemedi.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
    }
  });

  // Yeni Vardiya Şablonu Oluşturma Mutasyonu
  const createShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: shCode || `SH-${Math.floor(100 + Math.random() * 900)}`,
          name: shName || "Özel Şube Vardiyası",
          startClock: shStart,
          endClock: shEnd,
          graceMin: shGrace
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Vardiya eklenemedi.");
      return json;
    },
    onSuccess: () => {
      setShCode("");
      setShName("");
      queryClient.invalidateQueries({ queryKey: ["pdks-bootstrap"] });
    }
  });

  // Canlı Özet Metrikler & Recharts Veri Setleri
  const metrics = useMemo(() => {
    const emps = data?.employees || [];
    const filtered =
      branchFilter === "ALL"
        ? emps
        : emps.filter((e) => e.branch === branchFilter);
    const present = filtered.filter((e) => e.status === "PRESENT").length;
    const late = filtered.filter((e) => e.status === "LATE").length;
    const leave = filtered.filter((e) => e.status === "LEAVE").length;
    const absent = filtered.filter((e) => e.status === "ABSENT").length;

    const byDeptMap = new Map<
      string,
      { dept: string; present: number; late: number; overtimeMin: number; lateMin: number }
    >();

    for (const e of filtered) {
      const cur = byDeptMap.get(e.dept) || {
        dept: e.dept.replace(" Finansmanı", "").replace(" Finansman", ""),
        present: 0,
        late: 0,
        overtimeMin: 0,
        lateMin: 0
      };
      if (e.status === "PRESENT" || e.status === "LATE") cur.present++;
      if (e.status === "LATE") cur.late++;
      cur.overtimeMin += e.overtimeMin || 0;
      cur.lateMin += e.lateMin || 0;
      byDeptMap.set(e.dept, cur);
    }

    return {
      total: filtered.length,
      present,
      late,
      leave,
      absent,
      deptChart: Array.from(byDeptMap.values())
    };
  }, [data?.employees, branchFilter]);

  if (!inApp) return null;

  return (
    <>
      {/* Sağ Alt Yüzen Canlı PostgreSQL 18 + SSE Kokpit Butonu */}
      <div className="fixed bottom-5 right-5 z-[45] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 rounded-full border border-zinc-200/90 bg-white/95 px-4 py-2.5 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-md transition-[transform,background-color] duration-150 ease-spring-out hover:bg-zinc-50 active:scale-[0.97] dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-100"
          aria-label="Canlı Full-Stack PDKS Motorunu Aç"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                sseConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                sseConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <Database className="h-3.5 w-3.5 text-albayrak-red" />
          <span className="tabular-nums">
            Canlı PDKS & Vardiya Motoru · <b>{metrics.present + metrics.late}</b> İçeride
          </span>
          <Badge variant="ok" className="ml-0.5">
            PG18 · SSE
          </Badge>
        </button>
      </div>

      {/* Canlı Full-Stack PDKS Çekmecesi / Modalı (Framer Motion + Shadcn UI + Recharts) */}
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[2px]">
            <motion.aside
              key="live-hub-drawer"
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: "translateX(100%)" }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, transform: "translateX(0%)" }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: "translateX(100%)" }
              }
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="flex h-full w-full max-w-4xl flex-col border-l border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              role="dialog"
              aria-modal="true"
              aria-label="Canlı PDKS, AccessLogs, Vardiya ve Saatlik İzin Merkezi"
            >
              {/* Üst Başlık */}
              <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-albayrak-red/10 text-albayrak-red">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold tracking-tight">
                        Gerçek Zamanlı PDKS, AccessLogs & Vardiya Kokpiti
                      </h2>
                      <Badge variant={sseConnected ? "ok" : "warn"}>
                        {sseConnected ? "SSE Canlı Akış Aktif" : "Yeniden Bağlanıyor"}
                      </Badge>
                      <Badge variant="neutral">PostgreSQL 18 · Prisma · Zod</Badge>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Tüm zaman damgaları veritabanında <b>UTC (TIMESTAMPTZ)</b> saklanır,
                      ekranda <b>Europe/Istanbul (GMT+3)</b> olarak gösterilir.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                    />
                    Yenile
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(false)}
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              {/* Canlı Durum Kartları */}
              <div className="grid grid-cols-2 gap-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-3.5 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <span>Şu An İçeride (Ofiste)</span>
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-emerald-600">
                    {metrics.present}
                  </div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    Toplam {metrics.total} aktif kadro
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <span>Bugün Geç Kalan (Late)</span>
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-amber-600">
                    {metrics.late}
                  </div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    Vardiya hoşgörü süresi aşımı
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <span>İzinli / Raporlu (On Leave)</span>
                    <Users className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-sky-600">
                    {metrics.leave}
                  </div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    {data?.leaves.filter((l) => l.isHourly).length || 0} saatlik izin kaydı
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <span>Gün İçi Ham Geçiş (AccessLogs)</span>
                    <Activity className="h-3.5 w-3.5 text-albayrak-red" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {data?.accessLogs.length || 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    Giriş · Öğle · Mola · Çıkış
                  </div>
                </div>
              </div>

              {/* Sekme Menüsü */}
              <div
                role="tablist"
                aria-label="Canlı PDKS Kokpit Sekmeleri"
                className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 px-6 py-2.5 dark:border-zinc-800"
              >
                <Button
                  role="tab"
                  aria-selected={activeTab === "live"}
                  variant={activeTab === "live" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("live")}
                >
                  <Radio className="h-3.5 w-3.5" />
                  1. Canlı İzleme & Geçiş Simülatörü (SSE)
                </Button>
                <Button
                  role="tab"
                  aria-selected={activeTab === "access"}
                  variant={activeTab === "access" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("access")}
                >
                  <Layers className="h-3.5 w-3.5" />
                  2. Gün İçi Ara Geçişler (AccessLogs)
                </Button>
                <Button
                  role="tab"
                  aria-selected={activeTab === "shifts_leaves"}
                  variant={activeTab === "shifts_leaves" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("shifts_leaves")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  3. Vardiya & Saatlik İzin Yönetimi
                </Button>
                <Button
                  role="tab"
                  aria-selected={activeTab === "recharts"}
                  variant={activeTab === "recharts" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("recharts")}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  4. Recharts Departman Analitiği
                </Button>
              </div>

              {/* İçerik Alanı */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-44 w-full" />
                    <Skeleton className="h-44 w-full" />
                  </div>
                ) : activeTab === "live" ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Sol: Canlı Turnike / QR / Mobil Geofence Simülatörü */}
                    <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 lg:col-span-5 dark:border-zinc-800">
                      <div>
                        <h3 className="text-sm font-bold">
                          Canlı Kart / QR / 30m Mobil Geçiş Testi
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Bir personel seçip geçiş okuttuğunuzda PostgreSQL 18{" "}
                          <code>access_logs</code> tablosuna UTC olarak kaydedilir, ilk giriş{" "}
                          <code>checkIn</code>, son çıkış <code>checkOut</code> güncellenir ve
                          SSE ile ekrana düşer.
                        </p>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="mb-1 block font-semibold">Personel Seçin</label>
                          <select
                            value={simEmpId}
                            onChange={(e) => setSimEmpId(Number(e.target.value))}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {(data?.employees || []).slice(0, 60).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.sicil} · {e.name} ({e.dept} · {e.branch})
                              </option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const selEmp = (data?.employees || []).find((e) => e.id === simEmpId) || data?.employees?.[0];
                          const selBranch = (data?.branches || []).find((b) => b.code === selEmp?.branch) || data?.branches?.[0];
                          if (!selBranch) return null;
                          const bbox = `${(selBranch.lng - 0.0045).toFixed(5)}%2C${(selBranch.lat - 0.0032).toFixed(5)}%2C${(selBranch.lng + 0.0045).toFixed(5)}%2C${(selBranch.lat + 0.0032).toFixed(5)}`;
                          const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${selBranch.lat.toFixed(5)}%2C${selBranch.lng.toFixed(5)}`;
                          const inside30m = simDist <= (selBranch.radius || 30);
                          return (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                  {selBranch.name} ({selBranch.city})
                                </span>
                                <Badge variant={inside30m ? "ok" : "bad"}>
                                  {inside30m ? "30m Sınır İçinde" : "30m Sınır Dışı"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                {selBranch.address || `${selBranch.name} · ${selBranch.city}`}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] text-zinc-500">
                                <span>
                                  Koord: {selBranch.lat.toFixed(4)}, {selBranch.lng.toFixed(4)} · Tel:{" "}
                                  {selBranch.phone || "0850 222 0 252"}
                                </span>
                                <a
                                  href={
                                    selBranch.googleMapUrl &&
                                    selBranch.googleMapUrl.startsWith("https://")
                                      ? selBranch.googleMapUrl
                                      : `https://www.google.com/maps/search/?api=1&query=${selBranch.lat},${selBranch.lng}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-albayrak-red hover:underline"
                                >
                                  Google Harita ↗
                                </a>
                              </div>
                              <div className="mt-2 h-32 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <iframe
                                  title={`${selBranch.name} Harita`}
                                  src={osmUrl}
                                  className="h-full w-full border-0"
                                  loading="lazy"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="mb-1 block font-semibold">Geçiş Hareketi</label>
                            <select
                              value={simEvent}
                              onChange={(e) => setSimEvent(e.target.value)}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <option value="CHECK_IN">Sabah Giriş (Check-In)</option>
                              <option value="LUNCH_OUT">Öğle Arası Çıkış</option>
                              <option value="LUNCH_IN">Öğle Arası Dönüş</option>
                              <option value="BREAK_OUT">Kısa Mola Çıkışı</option>
                              <option value="BREAK_IN">Kısa Mola Dönüşü</option>
                              <option value="CHECK_OUT">Akşam Çıkış (Check-Out)</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block font-semibold">Okuma Kaynağı</label>
                            <select
                              value={simSource}
                              onChange={(e) => setSimSource(e.target.value)}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <option value="MOBILE_GEOFENCE">Mobil 30m Geofence</option>
                              <option value="QR_TURNSTILE">QR / Kapı Okuyucu</option>
                              <option value="WEB_MANUAL">İK Manuel Kayıt</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="mb-1 block font-semibold">
                              İşlem Saati (GMT+3)
                            </label>
                            <input
                              type="time"
                              value={simClock}
                              onChange={(e) => setSimClock(e.target.value)}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block font-semibold tabular-nums">
                              Şube Mesafesi: {simDist.toFixed(1)}m (Sınır: 30m)
                            </label>
                            <input
                              type="range"
                              min={1}
                              max={95}
                              step={0.5}
                              value={simDist}
                              onChange={(e) => setSimDist(Number(e.target.value))}
                              className="mt-2 w-full accent-albayrak-red"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                          <input
                            type="checkbox"
                            checked={simMockGps}
                            onChange={(e) => setSimMockGps(e.target.checked)}
                            className="accent-albayrak-red"
                          />
                          <span>
                            <b>Sahte GPS (Mock Location)</b> simülasyonu (Anında blokaj & BT alarmı)
                          </span>
                        </label>

                        <Button
                          className="w-full"
                          onClick={() => accessMutation.mutate()}
                          disabled={accessMutation.isPending}
                        >
                          {accessMutation.isPending
                            ? "PostgreSQL'e Kaydediliyor..."
                            : "Canlı Geçiş Gönder (SSE Yayınla)"}
                        </Button>

                        {simFeedback ? (
                          <div
                            className={`rounded-xl border p-3 text-xs ${
                              simFeedback.tone === "ok"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                            }`}
                          >
                            {simFeedback.text}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Sağ: Sayfa Yenilenmeden Akan Canlı Olay Akışı */}
                    <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 lg:col-span-7 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold">
                          Canlı SSE Bildirim & Yoklama Akışı (Sayfa Yenilenmeden)
                        </h3>
                        <Badge variant="info">{liveEvents.length} Canlı Olay</Badge>
                      </div>

                      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                        {liveEvents.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
                            Soldaki simülatörden bir giriş/çıkış veya 30m ihlali tetikleyin;
                            sayfa yenilenmeden anında buraya düşecektir.
                          </div>
                        ) : (
                          liveEvents.map((ev) => (
                            <motion.div
                              key={ev.id}
                              initial={
                                shouldReduceMotion
                                  ? { opacity: 0 }
                                  : { opacity: 0, transform: "scale(0.96)" }
                              }
                              animate={
                                shouldReduceMotion
                                  ? { opacity: 1 }
                                  : { opacity: 1, transform: "scale(1)" }
                              }
                              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/60"
                            >
                              <div className="flex items-start gap-2.5">
                                {ev.severity === "bad" ? (
                                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                ) : ev.severity === "warn" ? (
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                ) : (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                )}
                                <div>
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">
                                    {ev.title}
                                  </div>
                                  <div className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                                    {ev.message}
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums">
                                {new Date(ev.timestampUtc).toLocaleTimeString("tr-TR", {
                                  timeZone: "Europe/Istanbul"
                                })}
                              </span>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeTab === "access" ? (
                  /* SEKME 2: AccessLogs Ham Geçiş Tablosu (UTC + GMT+3) */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold">
                          Gün İçi Ham Geçiş Kayıtları (<code>access_logs</code> Tablosu)
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Personelin ilk girişi <code>checkIn</code>, son çıkışı{" "}
                          <code>checkOut</code> olarak işlenir; öğle arası ve kısa molalar burada
                          ham veri olarak tutulur.
                        </p>
                      </div>
                      <Badge variant="neutral">
                        Toplam {data?.accessLogs.length || 0} Kayıt
                      </Badge>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                          <tr>
                            <th className="px-3.5 py-2.5">Personel</th>
                            <th className="px-3.5 py-2.5">Hareket Tipi</th>
                            <th className="px-3.5 py-2.5">Kaynak</th>
                            <th className="px-3.5 py-2.5">Mesafe (30m)</th>
                            <th className="px-3.5 py-2.5">TR Saati (GMT+3)</th>
                            <th className="px-3.5 py-2.5">Veritabanı (UTC ISO-8601)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {(data?.accessLogs || []).slice(0, 45).map((log) => {
                            const meta = EVENT_TYPE_TR[log.eventType] || {
                              label: log.eventType,
                              tone: "info" as const
                            };
                            return (
                              <tr
                                key={log.id}
                                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                              >
                                <td className="px-3.5 py-2.5 font-medium">
                                  <div>{log.name}</div>
                                  <div className="text-[11px] text-zinc-500">
                                    {log.sicil} · {log.dept} ({log.branch})
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <Badge variant={meta.tone}>{meta.label}</Badge>
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-[11px]">
                                  {log.source}
                                </td>
                                <td className="px-3.5 py-2.5 tabular-nums">
                                  {log.distanceMeters.toFixed(1)} m
                                </td>
                                <td className="px-3.5 py-2.5 font-mono font-semibold tabular-nums">
                                  {log.dateIstanbul} {log.timeIstanbul}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-[11px] text-zinc-500 tabular-nums">
                                  {log.timestampUtc}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : activeTab === "shifts_leaves" ? (
                  /* SEKME 3: Vardiya Şablonları & Saatlik İzin Motoru */
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-5 lg:col-span-5">
                      {/* Saatlik / Günlük İzin Talebi Formu */}
                      <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <h3 className="text-sm font-bold">
                          Saatlik İzin & Günlük İzin Talebi Oluştur (Zod Doğrulamalı)
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Saatlik izin onaylandığında personelin o günkü gecikme süresinden (
                          <code>lateMin</code>) otomatik olarak düşülür.
                        </p>

                        <div className="space-y-2.5 text-xs">
                          <div>
                            <label className="mb-1 block font-semibold">Personel</label>
                            <select
                              value={lvEmpId}
                              onChange={(e) => setLvEmpId(Number(e.target.value))}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              {(data?.employees || []).slice(0, 60).map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.sicil} · {e.name} ({e.dept})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block font-semibold">İzin Türü</label>
                              <select
                                value={lvType}
                                onChange={(e) => setLvType(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                              >
                                <option value="Saatlik izin">Saatlik izin (Mazeret)</option>
                                <option value="Yıllık izin">Yıllık izin</option>
                                <option value="Mazeret izni">Mazeret izni (Tam gün)</option>
                                <option value="Sağlık raporu">Sağlık raporu</option>
                                <option value="Saha görevi">Saha görevi</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block font-semibold">Tarih</label>
                              <input
                                type="text"
                                value={lvDate}
                                onChange={(e) => setLvDate(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </div>
                          </div>

                          {lvType === "Saatlik izin" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block font-semibold">
                                  Başlangıç Saati
                                </label>
                                <input
                                  type="time"
                                  value={lvStartClock}
                                  onChange={(e) => setLvStartClock(e.target.value)}
                                  className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block font-semibold">Bitiş Saati</label>
                                <input
                                  type="time"
                                  value={lvEndClock}
                                  onChange={(e) => setLvEndClock(e.target.value)}
                                  className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="mb-1 block font-semibold">Gün Sayısı</label>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={lvDays}
                                onChange={(e) => setLvDays(Number(e.target.value))}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block font-semibold">Mazeret / Açıklama</label>
                            <input
                              type="text"
                              value={lvNote}
                              onChange={(e) => setLvNote(e.target.value)}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </div>

                          <Button
                            className="w-full"
                            onClick={() => createLeaveMutation.mutate()}
                            disabled={createLeaveMutation.isPending}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {createLeaveMutation.isPending
                              ? "Kaydediliyor..."
                              : "İzin Talebini PostgreSQL'e Kaydet"}
                          </Button>
                        </div>
                      </div>

                      {/* Vardiya Şablonları */}
                      <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <h3 className="text-sm font-bold">
                          Tanımlı Kurumsal Vardiya Şablonları (<code>shifts</code>)
                        </h3>
                        <div className="space-y-2">
                          {(data?.shifts || []).map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                            >
                              <div>
                                <div className="font-bold">{s.name}</div>
                                <div className="text-[11px] text-zinc-500">
                                  Kod: {s.code} · Hoşgörü: {s.graceMin} dk · Mola: {s.breakMin} dk
                                </div>
                              </div>
                              <Badge variant="info">
                                {hhmmFromMin(s.startMin)} – {hhmmFromMin(s.endMin)}
                              </Badge>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                          <input
                            type="text"
                            placeholder="Vardiya Kodu (Örn: GECE-01)"
                            value={shCode}
                            onChange={(e) => setShCode(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <input
                            type="text"
                            placeholder="Vardiya Adı"
                            value={shName}
                            onChange={(e) => setShName(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <input
                            type="time"
                            value={shStart}
                            onChange={(e) => setShStart(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <input
                            type="time"
                            value={shEnd}
                            onChange={(e) => setShEnd(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => createShiftMutation.mutate()}
                          disabled={createShiftMutation.isPending}
                        >
                          Yeni Vardiya Şablonu Ekle
                        </Button>
                      </div>
                    </div>

                    {/* Sağ: İzin & Saatlik İzin Onay Akışı (Pending -> Approved / Rejected) */}
                    <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 lg:col-span-7 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold">
                          Yıllık, Rapor ve Saatlik İzin Onay Akışı (Pending → Approved / Rejected)
                        </h3>
                        <Badge variant="warn">
                          {(data?.leaves || []).filter((l) => l.status === "PENDING").length} Bekleyen
                        </Badge>
                      </div>

                      <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
                        {(data?.leaves || []).map((lv) => (
                          <div
                            key={lv.id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-3.5 text-xs sm:flex-row sm:items-center dark:border-zinc-800"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-albayrak-red">
                                  {lv.id}
                                </span>
                                <span className="font-bold">{lv.name}</span>
                                <span className="text-zinc-500">
                                  ({lv.sicil} · {lv.dept})
                                </span>
                                <Badge variant={lv.isHourly ? "info" : "neutral"}>
                                  {lv.type}
                                  {lv.isHourly && lv.startClock && lv.endClock
                                    ? ` · ${lv.startClock}–${lv.endClock} (${fmtDurMin(
                                        lv.durationMin
                                      )})`
                                    : ` · ${lv.days} gün`}
                                </Badge>
                              </div>
                              <p className="text-zinc-600 dark:text-zinc-400">{lv.note}</p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {lv.status === "PENDING" ? (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() =>
                                      decideLeaveMutation.mutate({
                                        code: lv.id,
                                        status: "APPROVED"
                                      })
                                    }
                                  >
                                    Onayla
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() =>
                                      decideLeaveMutation.mutate({
                                        code: lv.id,
                                        status: "REJECTED"
                                      })
                                    }
                                  >
                                    Reddet
                                  </Button>
                                </>
                              ) : (
                                <Badge
                                  variant={lv.status === "APPROVED" ? "ok" : "bad"}
                                >
                                  {lv.status === "APPROVED" ? "Onaylandı" : "Reddedildi"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* SEKME 4: Recharts Departman Mesai & Gecikme Grafikleri */
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <h3 className="text-sm font-bold">
                        Departman Bazlı Günlük Fazla Mesai vs Gecikme Süresi (Recharts BarChart)
                      </h3>
                      <p className="mb-4 text-xs text-zinc-500">
                        PostgreSQL 18 canlı personel puantaj verisinden hesaplanan toplam dakika
                        dağılımı.
                      </p>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={metrics.deptChart}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                            <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar
                              dataKey="overtimeMin"
                              name="Toplam Ek Mesai (dk)"
                              fill="#10b981"
                              radius={[6, 6, 0, 0]}
                            />
                            <Bar
                              dataKey="lateMin"
                              name="Toplam Gecikme (dk)"
                              fill="#e31e24"
                              radius={[6, 6, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <h3 className="text-sm font-bold">
                        Departman Aktif Katılım & Geç Kalma Dağılımı (Recharts AreaChart)
                      </h3>
                      <div className="mt-4 h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metrics.deptChart}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                            <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="present"
                              name="Aktif Personel"
                              stroke="#1c1d1f"
                              fill="#1c1d1f"
                              fillOpacity={0.14}
                            />
                            <Area
                              type="monotone"
                              dataKey="late"
                              name="Geç Kalan"
                              stroke="#e31e24"
                              fill="#e31e24"
                              fillOpacity={0.22}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
