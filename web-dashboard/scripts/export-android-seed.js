/*
 * Android Room seed üretimi — PostgreSQL 18 tek doğruluk kaynağı.
 *
 * Kullanım (repo kökünden):
 *   node web-dashboard/scripts/export-android-seed.js
 *
 * Çıktı: app/src/main/assets/pdks_employees.json
 * 500 personel, gerçek sicil/ad/departman/şube ve vardiya (shift) bilgisiyle yazılır.
 * Böylece mobil demo verisi web panelindeki PostgreSQL kayıtlarıyla birebir eşleşir.
 */
const fs = require("node:fs");
const path = require("node:path");

const webRoot = path.join(__dirname, "..");
const root = path.join(webRoot, "..");
process.chdir(webRoot);

const envText = fs.readFileSync(path.join(webRoot, ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { PrismaClient } = require(path.join(webRoot, "node_modules", "@prisma", "client"));
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.employee.findMany({
    orderBy: { id: "asc" },
    include: { shift: true }
  });

  const payload = rows.map((e) => ({
    id: e.id,
    sicil: e.sicil,
    name: e.name,
    email: e.email,
    dept: e.dept,
    title: e.title,
    branchCode: e.branchCode,
    status: e.status,
    hireDate: e.hireDate,
    deviceId: e.deviceModel || "FN-DEV-9842",
    shiftStartMin: e.shift ? e.shift.startMin : 510,
    shiftEndMin: e.shift ? e.shift.endMin : 1050,
    shiftGraceMin: e.shift ? e.shift.graceMin : 5
  }));

  const target = path.join(root, "app", "src", "main", "assets", "pdks_employees.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 1), "utf8");

  const shiftCounts = payload.reduce((acc, e) => {
    const key = `${e.shiftStartMin}-${e.shiftEndMin}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(`[OK] ${payload.length} personel yazıldı -> ${target}`);
  console.log("[SHIFTS]", shiftCounts);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("[ERR]", err);
  await prisma.$disconnect();
  process.exit(1);
});
