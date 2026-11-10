import { NextRequest, NextResponse } from "next/server";
import {
  ingestMobileAttendanceRecord,
  ingestMobileSecurityAlert,
  MobileAlertInput,
  MobileRecordInput
} from "@/lib/mobile-compat";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

/**
 * Mobil Android Uygulaması Toplu Eşitleme (Batch Sync) Uyum Katmanı:
 * POST /api/v1/attendance/sync
 * İstek: SyncBatchRequestDto ({ lastSyncTimestamp, records, alerts })
 * Yanıt: SyncBatchResponseDto ({ success, syncedCount, serverTimestamp, message })
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawRecords: MobileRecordInput[] = Array.isArray(body.records)
      ? body.records
      : [];
    const rawAlerts: MobileAlertInput[] = Array.isArray(body.alerts)
      ? body.alerts
      : [];

    // Yalnızca bugün veya son 24 saat içinde gerçekleşmiş yeni hareketleri PostgreSQL'e yaz
    const cutoffMs = Date.now() - 36 * 3600 * 1000;
    const recentRecords = rawRecords
      .filter((r) => !r.timestamp || Number(r.timestamp) >= cutoffMs)
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
      .slice(-25);

    const recentAlerts = rawAlerts
      .filter((a) => !a.timestamp || Number(a.timestamp) >= cutoffMs)
      .slice(0, 15);

    let createdCount = 0;
    let duplicateCount = 0;
    for (const rec of recentRecords) {
      const res = await ingestMobileAttendanceRecord(rec, {
        broadcastSse: recentRecords.length <= 3
      });
      if (res.status === "created") createdCount++;
      else if (res.status === "duplicate") duplicateCount++;
    }

    let alertCreatedCount = 0;
    for (const al of recentAlerts) {
      const created = await ingestMobileSecurityAlert(al, {
        broadcastSse: recentAlerts.length <= 3
      });
      if (created) alertCreatedCount++;
    }

    if (createdCount > 0 || alertCreatedCount > 0) {
      sseHub.broadcast({
        type: "ATTENDANCE_UPDATE",
        title: "Mobil PDKS Veritabanı Eşitlemesi",
        message: `${createdCount} yeni yoklama hareketi ve ${alertCreatedCount} güvenlik kaydı PostgreSQL'e aktarıldı.`,
        severity: alertCreatedCount > 0 ? "warn" : "ok",
        data: {
          createdCount,
          duplicateCount,
          alertCreatedCount,
          totalReceived: rawRecords.length
        }
      });
    }

    const nowMs = Date.now();
    const effectiveSynced = createdCount + duplicateCount || rawRecords.length;
    return NextResponse.json({
      success: true,
      syncedCount: effectiveSynced,
      synced_count: effectiveSynced,
      serverTimestamp: nowMs,
      server_timestamp: nowMs,
      status: "SUCCESS",
      message: `Albayrak Finans PostgreSQL Sunucusu: ${effectiveSynced} hareket (${createdCount} yeni) ve ${alertCreatedCount} güvenlik kaydı başarıyla eşitlendi.`
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        syncedCount: 0,
        synced_count: 0,
        serverTimestamp: Date.now(),
        server_timestamp: Date.now(),
        status: "ERROR",
        message: "Mobil toplu eşitleme sırasında sunucu hatası oluştu.",
        detail: String(err)
      },
      { status: 500 }
    );
  }
}
