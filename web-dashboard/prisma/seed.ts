import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

function createRng(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function hhmm(m: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return `${pad2(Math.floor(c / 60))}:${pad2(c % 60)}`;
}

function trSlug(s: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    I: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u"
  };
  return s
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

interface ScrapedBranchItem {
  id: number;
  name: string;
  branch_code: string;
  city: string;
  district?: string;
  address?: string;
  phone?: string;
  googleMapUrl?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  wifi_ssid: string;
}

function loadBranchesSeed() {
  const candidates = [
    path.join(process.cwd(), "public", "assets", "branches.json"),
    path.resolve(__dirname, "../public/assets/branches.json")
  ];
  const jsonPath = candidates.find((p) => fs.existsSync(p));
  if (jsonPath) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as ScrapedBranchItem[];
    return raw.map((b, idx) => ({
      code: b.branch_code || `ŞB-${String(idx + 1).padStart(3, "0")}`,
      name: b.name,
      city: b.city,
      district: b.district || b.city,
      address: b.address || "",
      phone: b.phone || "444 88 61",
      googleMapUrl:
        b.googleMapUrl ||
        `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`,
      lat: b.latitude,
      lng: b.longitude,
      radiusMeters: b.radius_meters || 30,
      wifiSsid: b.wifi_ssid || `ALBAYRAK_${idx + 1}_WIFI`,
      weight: idx === 0 ? 0.16 : 0.84 / Math.max(1, raw.length - 1)
    }));
  }
  return [
    {
      code: "ŞB-001",
      name: "Albayrak Finans Genel Müdürlük (Ataşehir)",
      city: "İstanbul",
      district: "Ataşehir",
      address: "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul",
      phone: "444 88 61",
      googleMapUrl: "https://www.google.com/maps/search/?api=1&query=40.995454,29.140893",
      lat: 40.995454,
      lng: 29.140893,
      radiusMeters: 30,
      wifiSsid: "ALBAYRAK_GM_SECURE",
      weight: 1.0
    }
  ];
}

const BRANCHES_SEED = loadBranchesSeed();

const SHIFTS_SEED = [
  { code: "STD-0830", name: "Standart Kurumsal Mesai (08:30 – 17:30)", startMin: 510, endMin: 1050, breakMin: 60, graceMin: 5, isFlexible: false },
  { code: "HQ-0900", name: "Genel Merkez Uzman Vardiyası (09:00 – 18:00)", startMin: 540, endMin: 1080, breakMin: 60, graceMin: 10, isFlexible: false },
  { code: "OPS-0800", name: "Şube Erken Operasyon (08:00 – 17:00)", startMin: 480, endMin: 1020, breakMin: 60, graceMin: 5, isFlexible: false },
  { code: "FLEX-SAHA", name: "Esnek Saha & Müşteri Ziyaret Vardiyası", startMin: 510, endMin: 1050, breakMin: 60, graceMin: 15, isFlexible: true }
];

const DEPTS = [
  "Bireysel Finansman",
  "Taşıt Finansmanı",
  "Konut Finansmanı",
  "Kurumsal Finansman",
  "Şube Operasyon",
  "Bilgi Teknolojileri",
  "Mali İşler",
  "İnsan Kaynakları",
  "Hukuk ve Uyum"
];

const TITLES = [
  "Finans Uzmanı",
  "Müşteri Temsilcisi",
  "Operasyon Uzmanı",
  "Takım Lideri",
  "Uzman Yardımcısı",
  "Şube Müdür Yrd.",
  "Analist"
];

const FN = [
  "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "Ömer", "Yusuf", "Emre",
  "Burak", "Murat", "Serkan", "Hakan", "Caner", "Tolga", "Onur", "Kerem", "Barış", "Eren",
  "Berk", "Kaan", "Arda", "Alper", "Cem", "Deniz", "Ayşe", "Fatma", "Emine", "Hatice",
  "Zeynep", "Elif", "Meryem", "Zehra", "Merve", "Büşra", "Esra", "Gamze", "Seda", "Gizem",
  "Tuğba", "Kübra", "Ebru", "Betül", "Yasemin", "Duygu", "Pelin", "Damla", "Selin", "Ece",
  "İrem", "Başak", "Melis", "Ceren"
];

const LN = [
  "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
  "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
  "Polat", "Korkmaz", "Çakır", "Erdoğan", "Yavuz", "Güneş", "Bozkurt", "Ünal", "Acar", "Tekin"
];

const DEVICES = [
  ["Samsung S24", "Android 14"],
  ["Samsung A54", "Android 14"],
  ["iPhone 15", "iOS 17.5"],
  ["iPhone 14", "iOS 17.4"],
  ["Xiaomi 13T", "Android 14"],
  ["Redmi Note 13", "Android 13"],
  ["iPhone 13", "iOS 17.2"]
];

async function main() {
  console.log("PostgreSQL 18 finans_pdks veritabanı tohumlama (seed) başlatılıyor...");

  const existingBranchCount = await prisma.branch.count();
  const existingEmpCount = await prisma.employee.count();
  const shouldReseedEmployees = existingEmpCount < 500 || existingBranchCount < 50;

  if (shouldReseedEmployees) {
    await prisma.accessLog.deleteMany();
    await prisma.dailyAttendance.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.securityAlert.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.branch.deleteMany();
  }

  for (const b of BRANCHES_SEED) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: b,
      create: b
    });
  }

  const shifts = [];
  for (const s of SHIFTS_SEED) {
    const created = await prisma.shift.upsert({
      where: { code: s.code },
      update: s,
      create: s
    });
    shifts.push(created);
  }

  if (shouldReseedEmployees) {

    const rnd = createRng(20261020);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
    const wpickBranch = () => {
      const x = rnd();
      let acc = 0;
      for (const b of BRANCHES_SEED) {
        acc += b.weight;
        if (x <= acc) return b;
      }
      return BRANCHES_SEED[0];
    };

    const usedNames = new Set<string>();
    const empData = [];

    for (let i = 1; i <= 500; i++) {
      let name = "";
      let tries = 0;
      do {
        name = `${pick(FN)} ${pick(LN)}`;
      } while (usedNames.has(name) && ++tries < 20);
      usedNames.add(name);

      const br = wpickBranch();
      const dept = pick(DEPTS);
      const title = pick(TITLES);
      const u = rnd();
      const status = u < 0.875 ? "PRESENT" : u < 0.945 ? "LATE" : u < 0.982 ? "LEAVE" : "ABSENT";
      const inMin =
        status === "PRESENT"
          ? 8 * 60 + 15 + Math.floor(rnd() * 20)
          : status === "LATE"
          ? 8 * 60 + 42 + Math.floor(rnd() * 55)
          : null;
      const outMin =
        status === "PRESENT" || status === "LATE"
          ? 17 * 60 + 25 + Math.floor(rnd() * 65)
          : null;
      const lateMin = status === "LATE" && inMin ? inMin - (8 * 60 + 35) : 0;
      const overtimeMin = outMin && outMin > 17 * 60 + 40 ? outMin - (17 * 60 + 30) : 0;
      const distMeters =
        status === "PRESENT" || status === "LATE"
          ? +(2.5 + rnd() * 22).toFixed(1)
          : +(32 + rnd() * 90).toFixed(1);
      const dev = pick(DEVICES);
      const shiftObj =
        dept === "Şube Operasyon"
          ? shifts[2]
          : dept === "Bireysel Finansman" && i % 5 === 0
          ? shifts[3]
          : i % 4 === 0
          ? shifts[1]
          : shifts[0];

      empData.push({
        sicil: `FN-${1000 + i}`,
        name,
        dept,
        title,
        branchCode: br.code,
        shiftId: shiftObj.id,
        status,
        inMin,
        outMin,
        checkIn: inMin != null ? hhmm(inMin) : null,
        checkOut: outMin != null ? hhmm(outMin) : null,
        lateMin,
        overtimeMin,
        distMeters,
        deviceModel: dev[0],
        deviceOs: dev[1],
        appVersion: rnd() < 0.92 ? "2.4.1" : rnd() < 0.7 ? "2.4.0" : "2.3.8",
        deviceBound: rnd() > 0.03,
        email: `${trSlug(name)}@albayrakfinans.com.tr`,
        hireDate: `${2018 + Math.floor(rnd() * 8)}-${pad2(1 + Math.floor(rnd() * 12))}-${pad2(
          1 + Math.floor(rnd() * 28)
        )}`,
        leaveUsedDays: 2 + Math.floor(rnd() * 11),
        leaveTotalDays: 14
      });
    }

    await prisma.employee.createMany({ data: empData });
    console.log("500 personel PostgreSQL'e kaydedildi.");
  }

  const allEmployees = await prisma.employee.findMany({ orderBy: { id: "asc" }, take: 80 });

  // Gün içi AccessLogs (Giriş, Öğle Çıkış, Öğle Dönüş, Mola, Çıkış)
  const accessCount = await prisma.accessLog.count();
  if (accessCount === 0 && allEmployees.length > 0) {
    const now = new Date();
    const accessSeed = [];
    for (let idx = 0; idx < Math.min(35, allEmployees.length); idx++) {
      const e = allEmployees[idx];
      if (e.status === "ABSENT" || e.status === "LEAVE") continue;
      const inM = e.inMin ?? 510;
      const baseDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      // Türkiye saati GMT+3 olduğu için UTC = TR - 3 saat (-180 dk)
      const checkInUtc = new Date(baseDay.getTime() + (inM - 180) * 60000);
      const lunchOutUtc = new Date(baseDay.getTime() + (12 * 60 + 15 + (idx % 12) - 180) * 60000);
      const lunchInUtc = new Date(baseDay.getTime() + (13 * 60 + 5 + (idx % 10) - 180) * 60000);

      accessSeed.push(
        {
          employeeId: e.id,
          eventType: "CHECK_IN",
          source: "MOBILE_GEOFENCE",
          branchCode: e.branchCode,
          distanceMeters: e.distMeters,
          isMockGps: false,
          note: "Sabah ilk vardiya girişi (30m geofence doğrulandı)",
          timestampUtc: checkInUtc
        },
        {
          employeeId: e.id,
          eventType: "LUNCH_OUT",
          source: "MOBILE_GEOFENCE",
          branchCode: e.branchCode,
          distanceMeters: 4.2,
          isMockGps: false,
          note: "Öğle arası çıkış",
          timestampUtc: lunchOutUtc
        },
        {
          employeeId: e.id,
          eventType: "LUNCH_IN",
          source: "MOBILE_GEOFENCE",
          branchCode: e.branchCode,
          distanceMeters: 3.8,
          isMockGps: false,
          note: "Öğle arası dönüş",
          timestampUtc: lunchInUtc
        }
      );

      if (e.outMin) {
        const checkOutUtc = new Date(baseDay.getTime() + (e.outMin - 180) * 60000);
        accessSeed.push({
          employeeId: e.id,
          eventType: "CHECK_OUT",
          source: "MOBILE_GEOFENCE",
          branchCode: e.branchCode,
          distanceMeters: e.distMeters,
          isMockGps: false,
          note: "Akşam son vardiya çıkışı",
          timestampUtc: checkOutUtc
        });
      }
    }
    await prisma.accessLog.createMany({ data: accessSeed });
    console.log(`${accessSeed.length} adet gün içi AccessLog (mola/mobil konum) kaydı oluşturuldu.`);
  }

  // İzin Talepleri (Yıllık, Rapor, Saha ve Saatlik İzin dahil)
  const leaveCount = await prisma.leaveRequest.count();
  if (leaveCount === 0 && allEmployees.length >= 25) {
    const leaveTypes = [
      ["Yıllık izin", false, 3, 1440, "Yıllık ücretli izin talebi."],
      ["Saatlik izin", true, 0.25, 120, "Noter ve resmi kurum işlemi için 2 saatlik mazeret izni."],
      ["Mazeret izni", false, 1, 480, "Ailevi mazeret nedeniyle 1 günlük izin."],
      ["Saha görevi", false, 2, 960, "Kurumsal müşteri sözleşme ziyareti ve ekspertiz kontrolü."],
      ["Sağlık raporu", false, 2, 960, "Ayakta tedavi istirahat raporu (e-Nabız onaylı)."],
      ["Saatlik izin", true, 0.19, 90, "Sabah diş hekimi randevusu nedeniyle 08:30 - 10:00 arası saatlik izin."]
    ] as const;

    const leavesData = [];
    for (let i = 0; i < 18; i++) {
      const emp = allEmployees[i * 2];
      const tpl = leaveTypes[i % leaveTypes.length];
      const isHourly = tpl[1];
      const status = i < 7 ? "PENDING" : i < 15 ? "APPROVED" : "REJECTED";
      leavesData.push({
        code: `TL-${2401 + i}`,
        employeeId: emp.id,
        leaveType: tpl[0],
        isHourly,
        startDate: `${pad2(8 + (i % 15))}.10.2026`,
        endDate: isHourly ? `${pad2(8 + (i % 15))}.10.2026` : `${pad2(9 + (i % 15))}.10.2026`,
        startClock: isHourly ? (i % 2 === 0 ? "08:30" : "14:00") : null,
        endClock: isHourly ? (i % 2 === 0 ? "10:00" : "16:00") : null,
        days: tpl[2],
        durationMin: tpl[3],
        note: tpl[4],
        status,
        reviewerName: status === "PENDING" ? null : "Zehra Yılmaz"
      });
    }
    await prisma.leaveRequest.createMany({ data: leavesData });
    console.log("18 adet izin ve saatlik izin talebi oluşturuldu.");
  }

  // Güvenlik İhlalleri (30m Geofence & Mock GPS)
  const alertCount = await prisma.securityAlert.count();
  if (alertCount === 0 && allEmployees.length >= 30) {
    const alertTypes = [
      ["30m sınır aşımı", "HIGH", 78.4],
      ["Sahte GPS (Mock)", "HIGH", 142.0],
      ["Farklı cihaz", "MED", 12.4],
      ["Mesai dışı giriş", "MED", 8.2],
      ["Kurumsal Wi-Fi dışı", "MED", 28.5]
    ] as const;
    const alertsData = [];
    for (let i = 0; i < 22; i++) {
      const emp = allEmployees[i];
      const tpl = alertTypes[i % alertTypes.length];
      alertsData.push({
        code: `SEC-${8801 + i}`,
        employeeId: emp.id,
        branchCode: emp.branchCode,
        alertType: tpl[0],
        severity: tpl[1],
        distanceMeters: +(tpl[2] + (i % 7) * 6.3).toFixed(1),
        status: i < 7 ? "OPEN" : "CLOSED"
      });
    }
    await prisma.securityAlert.createMany({ data: alertsData });
    console.log("22 adet 30m geofence & sahte GPS güvenlik kaydı oluşturuldu.");
  }

  // Kullanıcı Hesapları (5 Rol: HR, IT, ADMIN, DEPT_MANAGER, PERSONNEL)
  const accounts = [
    {
      code: "ACC-1",
      email: "ik@albayrakfinans.com.tr",
      passwordHash: "Ik!2026demo",
      role: "HR",
      name: "Zehra Yılmaz",
      title: "İK Direktörü",
      branchCode: "ALL",
      managedDept: null,
      employeeSicil: "FN-4002",
      active: true,
      permsJson: JSON.stringify(["emp_view", "emp_add", "leave_manage", "analytics_view", "excel_export"])
    },
    {
      code: "ACC-2",
      email: "bt@albayrakfinans.com.tr",
      passwordHash: "Bt!2026demo",
      role: "IT",
      name: "Murat Doğan",
      title: "BT ve Siber Güvenlik Müdürü",
      branchCode: "ALL",
      managedDept: null,
      employeeSicil: "FN-5055",
      active: true,
      permsJson: JSON.stringify(["sec_radar", "device_manage", "support_reset", "branch_geofence", "audit_view"])
    },
    {
      code: "ACC-3",
      email: "admin@albayrakfinans.com.tr",
      passwordHash: "Admin!2026demo",
      role: "ADMIN",
      name: "Selim Albayrak",
      title: "Sistem ve Yetki Yöneticisi",
      branchCode: "ALL",
      managedDept: null,
      employeeSicil: "FN-1000",
      active: true,
      permsJson: JSON.stringify(["all_admin"])
    },
    {
      code: "ACC-4",
      email: "mudur@albayrakfinans.com.tr",
      passwordHash: "Mudur!2026demo",
      role: "DEPT_MANAGER",
      name: "Hakan Özdemir",
      title: "Bireysel Finansman Departman Müdürü",
      branchCode: "ŞB-001",
      managedDept: "Bireysel Finansman",
      employeeSicil: "FN-1012",
      active: true,
      permsJson: JSON.stringify(["emp_view", "leave_manage", "analytics_view"])
    },
    {
      code: "ACC-5",
      email: "personel@albayrakfinans.com.tr",
      passwordHash: "Per!2026demo",
      role: "PERSONNEL",
      name: allEmployees[0]?.name || "Ahmet Yılmaz",
      title: allEmployees[0]?.title || "Finans Uzmanı",
      branchCode: allEmployees[0]?.branchCode || "ŞB-001",
      managedDept: allEmployees[0]?.dept || "Bireysel Finansman",
      employeeSicil: allEmployees[0]?.sicil || "FN-1001",
      active: true,
      permsJson: JSON.stringify(["self_view"])
    }
  ];

  for (const acc of accounts) {
    const hashed = await hashPassword(acc.passwordHash);
    const payload = { ...acc, passwordHash: hashed };
    await prisma.userAccount.upsert({
      where: { email: acc.email },
      update: payload,
      create: payload
    });
  }

  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        { actorName: "Murat Doğan", actorRole: "BT", action: "Cihaz eşlemesi sıfırlandı", target: "FN-1042 · Burak Kaya", ipAddress: "10.24.18.42" },
        { actorName: "Zehra Yılmaz", actorRole: "İK", action: "Aylık puantaj raporu (.xlsx) indirildi", target: "Ekim 2026 · Tüm şubeler", ipAddress: "10.24.12.19" },
        { actorName: "Hakan Özdemir", actorRole: "MÜDÜR", action: "Saatlik izin onaylandı (08:30-10:00)", target: "TL-2402 · Bireysel Finansman", ipAddress: "10.24.12.55" },
        { actorName: "Sistem", actorRole: "AUTO", action: "Gece 01:00 şube koordinat senkronizasyonu tamamlandı", target: "50 şube · 30m geofence", ipAddress: "127.0.0.1" }
      ]
    });
  }

  console.log("PostgreSQL 18 finans_pdks tohumlama (seed) başarıyla tamamlandı!");
}

main()
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
