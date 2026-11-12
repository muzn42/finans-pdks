import { NextRequest, NextResponse } from "next/server";
import { errorDetail } from "@/lib/api-guard";
import { POST as postAccessLog, GET as getAccessLogs } from "../access-logs/route";

export const dynamic = "force-dynamic";

/**
 * Mobil Android Uygulaması (PdksRepository.kt) ve Web Uyumlu Yoklama Endpoint'i
 * Android'den gelen { employee_id, record_type: "GIRIS" | "CIKIS", distance_meters, is_mock }
 * yükünü standart AccessLog motoruna yönlendirir.
 */
export async function GET(req: NextRequest) {
  return getAccessLogs(req);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const rawNearby = Array.isArray(raw.nearbyWifis)
      ? raw.nearbyWifis
      : Array.isArray(raw.nearby_wifis)
      ? raw.nearby_wifis
      : [];

    const mapped = {
      employeeId: raw.employeeId ?? raw.employee_id ?? 1,
      eventType:
        raw.eventType ||
        (raw.record_type === "CIKIS"
          ? "CHECK_OUT"
          : raw.record_type === "OGLE_CIKIS"
          ? "LUNCH_OUT"
          : raw.record_type === "OGLE_DONUS"
          ? "LUNCH_IN"
          : "CHECK_IN"),
      source: raw.source || "MOBILE_GEOFENCE",
      branchCode: raw.branchCode || raw.branch_code || "ŞB-001",
      distanceMeters: Number(raw.distanceMeters ?? raw.distance_meters ?? 5.2),
      accuracyMeters:
        raw.accuracyMeters != null || raw.accuracy_meters != null || raw.accuracy != null
          ? Number(raw.accuracyMeters ?? raw.accuracy_meters ?? raw.accuracy)
          : undefined,
      locationAgeMs: Number(raw.locationAgeMs ?? raw.location_age_ms ?? 0),
      isMockGps: Boolean(raw.isMockGps ?? raw.is_mock ?? raw.locationMocked ?? raw.mocked ?? false),
      locationMocked: Boolean(raw.locationMocked ?? raw.mocked ?? raw.isMockGps ?? raw.is_mock ?? false),
      nearbyWifis: rawNearby,
      clockHhmm: raw.clockHhmm,
      note: raw.note || (raw.device_model ? `Cihaz: ${raw.device_model}` : undefined)
    };

    const proxyReq = new NextRequest(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(mapped)
    });
    return postAccessLog(proxyReq);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Yoklama verisi işlenemedi.", detail: errorDetail(err) },
      { status: 500 }
    );
  }
}
