import { z } from "zod";

export const VALID_BRANCH_CODES = ["HQ", "UMR", "KAD", "ANK", "IZM", "BUR"] as const;
export const VALID_DEPTS = [
  "Bireysel Finansman",
  "Taşıt Finansmanı",
  "Konut Finansmanı",
  "Kurumsal Finansman",
  "Şube Operasyon",
  "Bilgi Teknolojileri",
  "Mali İşler",
  "İnsan Kaynakları",
  "Hukuk ve Uyum"
] as const;

export const VALID_TITLES = [
  "Finans Uzmanı",
  "Müşteri Temsilcisi",
  "Operasyon Uzmanı",
  "Takım Lideri",
  "Uzman Yardımcısı",
  "Şube Müdür Yrd.",
  "Analist"
] as const;

export const VALID_STATUSES = ["PRESENT", "LATE", "LEAVE", "ABSENT"] as const;
export const VALID_ROLES = ["HR", "IT", "ADMIN", "DEPT_MANAGER", "PERSONNEL"] as const;
export const VALID_ACCESS_EVENTS = [
  "CHECK_IN",
  "LUNCH_OUT",
  "LUNCH_IN",
  "BREAK_OUT",
  "BREAK_IN",
  "CHECK_OUT"
] as const;

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const LoginSchema = z.object({
  email: z.string().trim().email("Geçerli bir kurumsal e-posta adresi giriniz."),
  password: z.string().min(3, "Parola en az 3 karakter olmalıdır."),
  portal: z.enum(["HR", "IT", "ADMIN", "DEPT_MANAGER", "PERSONNEL"]).optional()
});

export const EmployeeCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Personel ad soyad alanı en az 3 karakter olmalıdır.")
    .max(100, "Personel adı çok uzun."),
  sicil: z
    .string()
    .trim()
    .regex(/^FN-\d{4,6}$/, "Sicil numarası FN-XXXX formatında olmalıdır.")
    .optional(),
  dept: z.string().trim().min(2, "Departman seçimi zorunludur."),
  title: z.string().trim().min(2, "Görev / unvan seçimi zorunludur."),
  branch: z.string().trim().min(2, "Şube kodu zorunludur.").default("HQ"),
  shiftId: z.coerce.number().int().positive().default(1),
  status: z.enum(VALID_STATUSES).default("PRESENT"),
  checkIn: z.string().regex(hhmmRegex, "Giriş saati SS:DD formatında olmalıdır.").nullable().optional(),
  checkOut: z.string().regex(hhmmRegex, "Çıkış saati SS:DD formatında olmalıdır.").nullable().optional(),
  dist: z.coerce.number().min(0).max(500).default(6.2),
  device: z.string().trim().min(2).max(80).default("Kurumsal Android"),
  os: z.string().trim().min(2).max(40).default("Android 14"),
  ver: z.string().trim().default("2.4.1"),
  bound: z.boolean().default(true),
  email: z.string().trim().email("Geçerli bir kurumsal e-posta giriniz.").optional(),
  hireDate: z.string().trim().optional(),
  leaveUsed: z.coerce.number().int().min(0).max(60).default(0),
  leaveTotal: z.coerce.number().int().min(1).max(60).default(14)
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

export const AccessLogCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive("Geçerli bir personel seçilmelidir."),
  eventType: z.enum(VALID_ACCESS_EVENTS, {
    errorMap: () => ({ message: "Geçersiz geçiş hareketi tipi." })
  }),
  source: z.enum(["MOBILE_GEOFENCE", "QR_TURNSTILE", "WEB_MANUAL"]).default("MOBILE_GEOFENCE"),
  branchCode: z.string().trim().default("HQ"),
  distanceMeters: z.coerce.number().min(0).max(5000).default(5.4),
  isMockGps: z.boolean().default(false),
  clockHhmm: z.string().regex(hhmmRegex, "Saat SS:DD formatında olmalıdır.").optional(),
  note: z.string().trim().max(240).optional()
});

export const LeaveRequestCreateSchema = z
  .object({
    employeeId: z.coerce.number().int().positive("Personel seçimi zorunludur."),
    leaveType: z.enum([
      "Yıllık izin",
      "Mazeret izni",
      "Saatlik izin",
      "Saha görevi",
      "Sağlık raporu"
    ]),
    isHourly: z.boolean().default(false),
    startDate: z.string().trim().min(4, "Başlangıç tarihi zorunludur."),
    endDate: z.string().trim().min(4, "Bitiş tarihi zorunludur."),
    startClock: z.string().regex(hhmmRegex, "Başlangıç saati SS:DD olmalıdır.").optional().nullable(),
    endClock: z.string().regex(hhmmRegex, "Bitiş saati SS:DD olmalıdır.").optional().nullable(),
    days: z.coerce.number().min(0.1).max(90).default(1),
    note: z.string().trim().min(3, "Açıklama / mazeret notu en az 3 karakter olmalıdır.").max(500)
  })
  .refine(
    (data) => {
      if (data.leaveType === "Saatlik izin" || data.isHourly) {
        return Boolean(data.startClock && data.endClock);
      }
      return true;
    },
    {
      message: "Saatlik izin taleplerinde başlangıç ve bitiş saati (örn. 08:30 - 10:30) zorunludur.",
      path: ["startClock"]
    }
  );

export const LeaveDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewerName: z.string().trim().optional()
});

export const ShiftCreateSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(3).max(80),
  startClock: z.string().regex(hhmmRegex, "Başlangıç saati SS:DD olmalıdır."),
  endClock: z.string().regex(hhmmRegex, "Bitiş saati SS:DD olmalıdır."),
  breakMin: z.coerce.number().int().min(0).max(180).default(60),
  graceMin: z.coerce.number().int().min(0).max(60).default(5),
  isFlexible: z.boolean().default(false)
});
