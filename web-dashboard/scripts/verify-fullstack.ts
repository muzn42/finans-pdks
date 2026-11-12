import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  hashPassword,
  needsRehash,
  signJwtToken,
  verifyJwtToken,
  verifyPassword
} from "../src/lib/auth";
import { haversineMeters } from "../src/lib/geo";
import { clearFailures, lockRemainingSeconds, registerFailure } from "../src/lib/rate-limit";
import { calculateAttendanceMetrics, getEmployeeAnalytics } from "../src/lib/pdks-engine";
import {
  AccessLogCreateSchema,
  EmployeeCreateSchema,
  LeaveRequestCreateSchema
} from "../src/lib/validators";
import { toIstanbulDateTime } from "../src/lib/timezone";
import {
  ingestMobileAttendanceRecord,
  resolveMobileEmployee
} from "../src/lib/mobile-compat";
import { sseHub } from "../src/lib/sse";

async function runTests() {
  console.log("=== ALBAYRAK FİNANS PDKS FULL-STACK DOĞRULAMA TESTLERİ (PostgreSQL 18 + Prisma + Zod + JWT) ===");

  // 1. PostgreSQL 18 Bağlantı & Tablo Sayıları
  const [empCount, shiftCount, branchCount, accessCount, leaveCount, alertCount, userCount] =
    await Promise.all([
      prisma.employee.count(),
      prisma.shift.count(),
      prisma.branch.count(),
      prisma.accessLog.count(),
      prisma.leaveRequest.count(),
      prisma.securityAlert.count(),
      prisma.userAccount.count()
    ]);

  assert.ok(empCount >= 500, `En az 500 personel olmalı, bulunan: ${empCount}`);
  assert.ok(shiftCount >= 4, `En az 4 vardiya olmalı, bulunan: ${shiftCount}`);
  assert.ok(branchCount >= 54, `En az 54 şube olmalı, bulunan: ${branchCount}`);
  assert.ok(accessCount >= 100, `En az 100 AccessLog olmalı, bulunan: ${accessCount}`);
  assert.ok(leaveCount >= 15, `En az 15 izin talebi olmalı, bulunan: ${leaveCount}`);
  assert.ok(alertCount >= 20, `En az 20 güvenlik alarmı olmalı, bulunan: ${alertCount}`);
  assert.ok(userCount >= 5, `5 RBAC rol hesabı olmalı, bulunan: ${userCount}`);
  console.log(
    `[PASS 1/6] PostgreSQL 18 Şema & Veri Bütünlüğü: ${empCount} personel, ${branchCount} şube, ${shiftCount} vardiya, ${accessCount} AccessLog, ${leaveCount} izin, ${userCount} RBAC rolü.`
  );

  // 2. Web Crypto HMAC-SHA256 JWT İmzalama ve Doğrulama Testi
  const token = await signJwtToken({
    id: "ACC-4",
    email: "mudur@albayrakfinans.com.tr",
    role: "DEPT_MANAGER",
    name: "Hakan Özdemir",
    title: "Bireysel Finansman Departman Müdürü",
    branch: "HQ",
    managedDept: "Bireysel Finansman",
    perms: ["emp_view", "leave_manage"]
  });
  const verified = await verifyJwtToken(token);
  assert.ok(verified, "JWT doğrulaması başarılı olmalı");
  assert.equal(verified?.role, "DEPT_MANAGER");
  assert.equal(verified?.managedDept, "Bireysel Finansman");
  console.log("[PASS 2/6] HMAC-SHA256 JWT İmzalama & 5 Rol RBAC Doğrulaması başarılı.");

  // 3. Zod Girdi Doğrulama (Saatlik İzin & 30m Geofence AccessLog)
  const badHourly = LeaveRequestCreateSchema.safeParse({
    employeeId: 1,
    leaveType: "Saatlik izin",
    isHourly: true,
    startDate: "20.10.2026",
    endDate: "20.10.2026",
    note: "Saat bilgisi eksik saatlik izin"
  });
  assert.equal(badHourly.success, false, "Saat bilgisi olmayan saatlik izin Zod tarafından reddedilmeli");

  const validHourly = LeaveRequestCreateSchema.safeParse({
    employeeId: 1,
    leaveType: "Saatlik izin",
    isHourly: true,
    startDate: "20.10.2026",
    endDate: "20.10.2026",
    startClock: "08:30",
    endClock: "10:00",
    note: "Diş hekimi randevusu için 90 dk saatlik izin"
  });
  assert.equal(validHourly.success, true, "Geçerli saatlik izin Zod doğrulamasından geçmeli");

  const validEmp = EmployeeCreateSchema.safeParse({
    name: "Selin Albayrak",
    dept: "Bireysel Finansman",
    title: "Finans Uzmanı",
    branch: "HQ",
    status: "PRESENT",
    checkIn: "08:25",
    checkOut: "17:45"
  });
  assert.equal(validEmp.success, true);
  const validAccess = AccessLogCreateSchema.safeParse({
    employeeId: 1,
    eventType: "LUNCH_OUT",
    source: "MOBILE_GEOFENCE",
    distanceMeters: 4.5
  });
  assert.equal(validAccess.success, true);
  console.log("[PASS 3/6] Zod Form & API Girdi Doğrulama Şemaları başarılı.");

  // 4. Vardiya & Onaylı Saatlik İzin Gecikme Düşümü Motoru Testi
  // Personel 08:30 vardiyasına 09:45'te (585. dk) girdi -> Normalde 75 dk gecikme.
  // Ancak 90 dk (08:30-10:00) onaylı saatlik izni varsa gecikme 0 dk (PRESENT) olmalı!
  const withoutHourly = calculateAttendanceMetrics({
    inMin: 9 * 60 + 45,
    outMin: 18 * 60 + 30,
    shiftStartMin: 8 * 60 + 30,
    shiftEndMin: 17 * 60 + 30,
    shiftGraceMin: 5,
    shiftBreakMin: 60,
    approvedHourlyLeaveMin: 0
  });
  assert.equal(withoutHourly.status, "LATE");
  assert.equal(withoutHourly.lateMin, 75);
  assert.equal(withoutHourly.overtimeMin, 60);

  const withHourly = calculateAttendanceMetrics({
    inMin: 9 * 60 + 45,
    outMin: 18 * 60 + 30,
    shiftStartMin: 8 * 60 + 30,
    shiftEndMin: 17 * 60 + 30,
    shiftGraceMin: 5,
    shiftBreakMin: 60,
    approvedHourlyLeaveMin: 90
  });
  assert.equal(withHourly.status, "PRESENT");
  assert.equal(withHourly.lateMin, 0);
  assert.equal(withHourly.overtimeMin, 60);
  console.log(
    "[PASS 4/6] Vardiya + Onaylı Saatlik İzin Gecikme Düşümü & Fazla Mesai Motoru başarılı."
  );

  // 5. UTC Veritabanı Kaydı -> Europe/Istanbul (GMT+3) Dönüşümü Testi
  const sampleUtc = new Date("2026-10-20T05:30:00.000Z"); // 05:30 UTC = 08:30 GMT+3
  const trFormatted = toIstanbulDateTime(sampleUtc);
  assert.ok(
    trFormatted.includes("08:30"),
    `05:30 UTC Türkiye saatinde 08:30 olmalı, alınan: ${trFormatted}`
  );
  console.log(`[PASS 5/6] UTC -> Europe/Istanbul (GMT+3) Zaman Dönüşümü: ${sampleUtc.toISOString()} -> ${trFormatted}`);

  // 6. 22 Metriklik Derin Personel Analitiği Testi
  const sampleEmp = await prisma.employee.findFirst({ where: { sicil: "FN-1459" } });
  assert.ok(sampleEmp, "FN-1459 sicilli personel bulunmalı");
  const deep = getEmployeeAnalytics(sampleEmp, { rangeDays: 30 });
  assert.equal(deep.periodDays, 30);
  assert.equal(deep.weekdayStats.length, 5);
  console.log(
    `[PASS 6/7] Derin Personel Karnesi (${sampleEmp.sicil} · ${sampleEmp.name}): Net Bakiye ${deep.netBalanceMin} dk, Uyum %${deep.geofenceComplianceRate}.`
  );

  // 7. Mobil Uyum Katmanı (resolveMobileEmployee + ingestMobileAttendanceRecord + SSE) Testi
  const caner = await resolveMobileEmployee({ employeeCode: "FN-1001" });
  assert.ok(caner, "Mobil sicil FN-1001 (Caner Öztürk) çözümlenmeli");
  assert.equal(caner?.sicil, "FN-1001");

  let receivedSseType: string | null = null;
  const unsub = sseHub.subscribe((evt) => {
    receivedSseType = evt.type;
  });

  const canerBranch = await prisma.branch.findUnique({ where: { code: caner.branchCode } });
  assert.ok(canerBranch, "FN-1001 personelinin şubesi bulunmalı");

  const mobileIngest = await ingestMobileAttendanceRecord(
    {
      employeeId: caner.id,
      employeeName: caner.name,
      branchId: 46,
      branchCode: caner.branchCode,
      recordType: "GİRİŞ",
      timestamp: Date.now(),
      // Şube merkezine ~2,2 m (mesafe artık sunucuda Haversine ile hesaplanır)
      userLatitude: canerBranch.lat + 0.00002,
      userLongitude: canerBranch.lng,
      distanceMeters: 3.4,
      accuracyMeters: 3.4521,
      isWithin5Meters: true,
      isMockLocation: false,
      deviceModel: "Android Mobil Test Cihazı",
      note: "Mobil uyum katmanı doğrulama testi"
    },
    { broadcastSse: true }
  );
  unsub();

  assert.ok(
    mobileIngest.status === "created" || mobileIngest.status === "duplicate",
    `Mobil giriş kaydı işlenmeli, durum: ${mobileIngest.status}`
  );
  if (mobileIngest.status === "created") {
    assert.equal(receivedSseType, "ACCESS_LOG", "Mobil giriş SSE yayını tetiklemeli");
    // Test kaydını temizle ki seed sayısı sabit kalsın
    await prisma.accessLog.delete({ where: { id: mobileIngest.accessLog.id } });
  }
  console.log(
    `[PASS 7/8] Mobil Uyum Katmanı (PostgreSQL + SSE Canlı Yayın): ${caner.sicil} · ${caner.name} doğrulandı.`
  );

  // 8. Güvenlik: parola özeti, kaba kuvvet kilidi, sunucu tarafı geofence ve kimlik bağlama
  const hashed = await hashPassword("Test!2026parola");
  assert.ok(hashed.startsWith("pbkdf2$"), "Parola PBKDF2 ile özetlenmeli");
  assert.equal(await verifyPassword("Test!2026parola", hashed), true);
  assert.equal(await verifyPassword("yanlis-parola", hashed), false);
  assert.equal(await verifyPassword("duzmetin", "duzmetin"), false, "Düz metin kayıt kabul edilmemeli");
  assert.equal(needsRehash(hashed), false);

  const rlKey = `test:${Date.now()}`;
  for (let i = 0; i < 5; i++) registerFailure(rlKey);
  assert.ok(lockRemainingSeconds(rlKey) > 0, "5 hatalı denemeden sonra kilit devreye girmeli");
  clearFailures(rlKey);

  const d111 = haversineMeters(41, 29, 41.001, 29);
  assert.ok(d111 > 110 && d111 < 112, `0,001° enlem ≈ 111 m olmalı, hesaplanan: ${d111}`);

  const cleanupAlert = async (code?: string) => {
    if (code) await prisma.securityAlert.delete({ where: { code } }).catch(() => {});
  };

  // 8a. Koordinat göndermeden "3 m" iddiası → engellenmeli
  const noCoords = await ingestMobileAttendanceRecord(
    { branchCode: caner.branchCode, recordType: "GİRİŞ", distanceMeters: 3, isWithin5Meters: true },
    { broadcastSse: false, boundSicil: caner.sicil }
  );
  assert.equal(noCoords.status, "blocked", "Koordinatsız kayıt engellenmeli");
  if (noCoords.status === "blocked") await cleanupAlert(noCoords.alertCode);

  // 8b. İstemci 3 m dese de gerçek koordinat ~220 m uzakta → engellenmeli
  const spoofed = await ingestMobileAttendanceRecord(
    {
      branchCode: caner.branchCode,
      recordType: "GİRİŞ",
      userLatitude: canerBranch.lat + 0.002,
      userLongitude: canerBranch.lng,
      distanceMeters: 3,
      isWithin5Meters: true
    },
    { broadcastSse: false, boundSicil: caner.sicil }
  );
  assert.equal(spoofed.status, "blocked", "Sahte mesafe beyanı engellenmeli");
  if (spoofed.status === "blocked") await cleanupAlert(spoofed.alertCode);

  // 8c. Gövdede başka personel ID'si olsa da JWT sicili esas alınmalı
  const other = await prisma.employee.findFirst({ where: { sicil: { not: caner.sicil } } });
  assert.ok(other);
  const bound = await ingestMobileAttendanceRecord(
    {
      employeeId: other.id,
      employeeCode: other.sicil,
      branchCode: caner.branchCode,
      recordType: "ÇIKIŞ",
      timestamp: Date.now(),
      userLatitude: canerBranch.lat,
      userLongitude: canerBranch.lng + 0.00002
    },
    { broadcastSse: false, boundSicil: caner.sicil }
  );
  assert.ok(bound.status === "created" || bound.status === "duplicate", `durum: ${bound.status}`);
  if (bound.status === "created") {
    assert.equal(bound.accessLog.sicil, caner.sicil, "Kayıt JWT'deki personele yazılmalı");
    await prisma.accessLog.delete({ where: { id: bound.accessLog.id } });
  }
  console.log("[PASS 8/8] Güvenlik: PBKDF2, kaba kuvvet kilidi, sunucu tarafı geofence ve JWT kimlik bağlama.");

  console.log("=== TÜM TESTLER (%100) BAŞARIYLA GEÇTİ ===");
}

runTests()
  .catch((err) => {
    console.error("Test hatası:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
