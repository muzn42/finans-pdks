import { NextRequest, NextResponse } from "next/server";
import {
  ingestMobileAttendanceRecord,
  MobileRecordInput
} from "@/lib/mobile-compat";

export const dynamic = "force-dynamic";

/**
 * Mobil Android Uygulaması Tekil Anlık Giriş/Çıkış Uyum Katmanı:
 * POST /api/v1/attendance/record
 * İstek: AttendanceRecordDto
 * Yanıt: SyncBatchResponseDto ({ success, syncedCount, serverTimestamp, message })
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MobileRecordInput;
    const result = await ingestMobileAttendanceRecord(body, {
      broadcastSse: true
    });

    const nowMs = Date.now();
    if (result.status === "blocked") {
      return NextResponse.json(
        {
          success: false,
          syncedCount: 0,
          synced_count: 0,
          serverTimestamp: nowMs,
          server_timestamp: nowMs,
          status: "BLOCKED",
          message: result.message
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      syncedCount: 1,
      synced_count: 1,
      serverTimestamp: nowMs,
      server_timestamp: nowMs,
      status: "SUCCESS",
      message:
        result.status === "created"
          ? `${result.employee.name} (${result.employee.sicil}) giriş/çıkış kaydı PostgreSQL'e işlendi ve web paneline canlı yayınlandı.`
          : "Giriş/çıkış kaydı sunucu ile eşitlendi."
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
        message: "Mobil yoklama kaydı işlenemedi.",
        detail: String(err)
      },
      { status: 500 }
    );
  }
}
