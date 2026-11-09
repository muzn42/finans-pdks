import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessLogCreateSchema } from "@/lib/validators";
import { calculateAttendanceMetrics, hhmmFromMin, minFromHhmm } from "@/lib/pdks-engine";
import { toIstanbulDate, toIstanbulTime } from "@/lib/timezone";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  CHECK_IN: "Sabah Giriş (Check-In)",
  LUNCH_OUT: "Öğle Arası Çıkış",
  LUNCH_IN: "Öğle Arası Dönüş",
  BREAK_OUT: "Kısa Mola Çıkışı",
  BREAK_IN: "Kısa Mola Dönüşü",
  CHECK_OUT: "Akşam Çıkış (Check-Out)"
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empId = searchParams.get("employeeId");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 80)));

    const where = empId ? { employeeId: Number(empId) } : {};
    const rows = await prisma.accessLog.findMany({
      where,
      include: {
        employee: {
          select: { id: true, sicil: true, name: true, dept: true, branchCode: true }
        }
      },
      orderBy: { timestampUtc: "desc" },
      take: limit
    });

    return NextResponse.json({
      status: "success",
      count: rows.length,
      accessLogs: rows.map((a) => ({
        id: a.id,
        empId: a.employeeId,
        sicil: a.employee.sicil,
        name: a.employee.name,
        dept: a.employee.dept,
        branch: a.branchCode,
        eventType: a.eventType,
        eventLabel: EVENT_LABELS[a.eventType] || a.eventType,
        source: a.source,
        distanceMeters: a.distanceMeters,
        isMockGps: a.isMockGps,
        note: a.note,
        timestampUtc: a.timestampUtc.toISOString(),
        timeIstanbul: toIstanbulTime(a.timestampUtc),
        dateIstanbul: toIstanbulDate(a.timestampUtc)
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "AccessLogs kayıtları alınamadı.", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AccessLogCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues[0]?.message || "Geçersiz geçiş verisi.",
          errors: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const emp = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: { shift: true }
    });

    if (!emp) {
      return NextResponse.json(
        { status: "error", message: "Personel bulunamadı." },
        { status: 404 }
      );
    }

    // 1. Sahte GPS (Mock Location) veya 30m Geofence İhlal Kontrolü
    if (data.isMockGps || data.distanceMeters > 30.0) {
      const alertType = data.isMockGps ? "Sahte GPS (Mock)" : "30m sınır aşımı";
      const alertCode = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const alert = await prisma.securityAlert.create({
        data: {
          code: alertCode,
          employeeId: emp.id,
          branchCode: data.branchCode || emp.branchCode,
          alertType,
          severity: "HIGH",
          distanceMeters: data.distanceMeters,
          status: "OPEN"
        }
      });

      sseHub.broadcast({
        type: "SECURITY_ALERT",
        title: `Güvenlik İhlali: ${alertType}`,
        message: `${emp.name} (${emp.sicil}) · ${data.distanceMeters.toFixed(1)}m mesafeden işlem engellendi!`,
        severity: "bad",
        data: {
          id: alert.code,
          empId: emp.id,
          sicil: emp.sicil,
          name: emp.name,
          dept: emp.dept,
          branch: emp.branchCode,
          type: alertType,
          sev: "HIGH",
          dist: data.distanceMeters,
          status: "OPEN"
        }
      });

      return NextResponse.json(
        {
          status: "blocked",
          message: `${alertType} tespit edildi (${data.distanceMeters.toFixed(
            1
          )}m > 30.0m). İşlem engellendi ve BT Güvenlik Radarına alarm üretildi.`,
          alertCode
        },
        { status: 403 }
      );
    }

    // 2. UTC zaman damgası üretimi
    const now = new Date();
    let timestampUtc = now;
    let clockMin =
      minFromHhmm(data.clockHhmm) ??
      minFromHhmm(toIstanbulTime(now)) ??
      8 * 60 + 30;

    if (data.clockHhmm) {
      const parsedMin = minFromHhmm(data.clockHhmm);
      if (parsedMin != null) {
        clockMin = parsedMin;
        const baseDayUtc = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
        );
        // Europe/Istanbul GMT+3 -> UTC = clockMin - 180 dk
        timestampUtc = new Date(baseDayUtc.getTime() + (clockMin - 180) * 60000);
      }
    }

    const workDateIstanbul = toIstanbulDate(timestampUtc); // DD.MM.YYYY
    const [dd, mm, yyyy] = workDateIstanbul.split(".");
    const workDateIso = dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : timestampUtc.toISOString().slice(0, 10);

    const { accessLog, updatedEmp } = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.accessLog.create({
        data: {
          employeeId: emp.id,
          eventType: data.eventType,
          source: data.source,
          branchCode: data.branchCode || emp.branchCode,
          distanceMeters: data.distanceMeters,
          isMockGps: false,
          note: data.note || EVENT_LABELS[data.eventType] || data.eventType,
          timestampUtc
        }
      });

      // 3. İlk giriş (checkIn) ve son çıkış (checkOut) güncellemesi + Onaylı Saatlik İzin kontrolü
      let nextInMin = emp.inMin;
      let nextOutMin = emp.outMin;

      if (data.eventType === "CHECK_IN") {
        nextInMin = nextInMin == null ? clockMin : Math.min(nextInMin, clockMin);
      } else if (data.eventType === "CHECK_OUT") {
        nextOutMin = nextOutMin == null ? clockMin : Math.max(nextOutMin, clockMin);
      }

      const approvedHourlyLeaves = await tx.leaveRequest.findMany({
        where: {
          employeeId: emp.id,
          isHourly: true,
          status: "APPROVED",
          startDate: { in: [workDateIstanbul, workDateIso] }
        }
      });
      const approvedHourlyMin = approvedHourlyLeaves.reduce(
        (acc, l) => acc + (l.durationMin || 0),
        0
      );

      const calc = calculateAttendanceMetrics({
        inMin: nextInMin,
        outMin: nextOutMin,
        shiftStartMin: emp.shift?.startMin ?? 510,
        shiftEndMin: emp.shift?.endMin ?? 1050,
        shiftGraceMin: emp.shift?.graceMin ?? 5,
        shiftBreakMin: emp.shift?.breakMin ?? 60,
        approvedHourlyLeaveMin: approvedHourlyMin
      });

      const empAfter = await tx.employee.update({
        where: { id: emp.id },
        data: {
          status: calc.status,
          inMin: nextInMin,
          outMin: nextOutMin,
          checkIn: hhmmFromMin(nextInMin),
          checkOut: hhmmFromMin(nextOutMin),
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          distMeters: data.distanceMeters
        },
        include: { shift: true }
      });

      await tx.dailyAttendance.upsert({
        where: {
          employeeId_workDate: {
            employeeId: emp.id,
            workDate: workDateIso
          }
        },
        update: {
          inMin: nextInMin,
          outMin: nextOutMin,
          workedMin: calc.workedMin,
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          hourlyLeaveMin: approvedHourlyMin,
          distanceMeters: data.distanceMeters,
          status: calc.status,
          ...(data.eventType === "CHECK_IN" ? { checkInUtc: timestampUtc } : {}),
          ...(data.eventType === "CHECK_OUT" ? { checkOutUtc: timestampUtc } : {})
        },
        create: {
          employeeId: emp.id,
          workDate: workDateIso,
          checkInUtc: data.eventType === "CHECK_IN" ? timestampUtc : null,
          checkOutUtc: data.eventType === "CHECK_OUT" ? timestampUtc : null,
          inMin: nextInMin,
          outMin: nextOutMin,
          workedMin: calc.workedMin,
          lateMin: calc.lateMin,
          overtimeMin: calc.overtimeMin,
          hourlyLeaveMin: approvedHourlyMin,
          distanceMeters: data.distanceMeters,
          status: calc.status
        }
      });

      return { accessLog: createdLog, updatedEmp: empAfter };
    });

    const dtoAccess = {
      id: accessLog.id,
      empId: emp.id,
      sicil: emp.sicil,
      name: emp.name,
      dept: emp.dept,
      branch: accessLog.branchCode,
      eventType: accessLog.eventType,
      eventLabel: EVENT_LABELS[accessLog.eventType] || accessLog.eventType,
      source: accessLog.source,
      distanceMeters: accessLog.distanceMeters,
      isMockGps: accessLog.isMockGps,
      note: accessLog.note,
      timestampUtc: accessLog.timestampUtc.toISOString(),
      timeIstanbul: toIstanbulTime(accessLog.timestampUtc),
      dateIstanbul: toIstanbulDate(accessLog.timestampUtc)
    };

    sseHub.broadcast({
      type: "ACCESS_LOG",
      title: `${EVENT_LABELS[data.eventType] || data.eventType}`,
      message: `${emp.name} (${emp.sicil}) · Saat ${dtoAccess.timeIstanbul} (${data.distanceMeters.toFixed(
        1
      )}m)`,
      severity: updatedEmp.status === "LATE" && data.eventType === "CHECK_IN" ? "warn" : "ok",
      data: {
        accessLog: dtoAccess,
        employee: {
          id: updatedEmp.id,
          sicil: updatedEmp.sicil,
          status: updatedEmp.status,
          inMin: updatedEmp.inMin,
          outMin: updatedEmp.outMin,
          checkIn: updatedEmp.checkIn,
          checkOut: updatedEmp.checkOut,
          lateMin: updatedEmp.lateMin,
          overtimeMin: updatedEmp.overtimeMin,
          dist: updatedEmp.distMeters
        }
      }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `${emp.name} için ${EVENT_LABELS[data.eventType]} kaydedildi.`,
        accessLog: dtoAccess,
        attendance: {
          status: updatedEmp.status,
          checkIn: updatedEmp.checkIn,
          checkOut: updatedEmp.checkOut,
          lateMin: updatedEmp.lateMin,
          overtimeMin: updatedEmp.overtimeMin
        }
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Geçiş hareketi kaydedilemedi.", detail: String(err) },
      { status: 500 }
    );
  }
}
