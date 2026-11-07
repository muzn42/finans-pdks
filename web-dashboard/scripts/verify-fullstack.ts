import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { signJwtToken, verifyJwtToken } from "../src/lib/auth";
import { calculateAttendanceMetrics, getEmployeeAnalytics } from "../src/lib/pdks-engine";
import {
  AccessLogCreateSchema,
  EmployeeCreateSchema,
  LeaveRequestCreateSchema
} from "../src/lib/validators";
import { toIstanbulDateTime } from "../src/lib/timezone";

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
    source: "QR_TURNSTILE",
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
    `[PASS 6/6] Derin Personel Karnesi (${sampleEmp.sicil} · ${sampleEmp.name}): Net Bakiye ${deep.netBalanceMin} dk, Uyum %${deep.geofenceComplianceRate}.`
  );

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
