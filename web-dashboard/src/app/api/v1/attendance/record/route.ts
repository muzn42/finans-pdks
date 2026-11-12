import { NextRequest, NextResponse } from "next/server";
import {
  ingestMobileAttendanceRecord,
  MobileRecordInput
} from "@/lib/mobile-compat";
import { errorDetail, requireUser } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * Mobil Android Uygulaması Tekil Anlık Giriş/Çıkış Uyum Katmanı:
 * POST /api/v1/attendance/record
 * İstek: AttendanceRecordDto  (Authorization: Bearer <personel JWT>)
 * Yanıt: SyncBatchResponseDto ({ success, syncedCount, serverTimestamp, message })
 *
 * Personel kimliği istek gövdesinden değil JWT'den alınır.
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req, ["PERSONNEL"]);
  if (!guard.ok) return guard.response;
  const boundSicil = guard.user.employeeSicil;
  if (!boundSicil) {
    return NextResponse.json(
      { success: false, status: "ERROR", message: "Oturumda personel sicili bulunamadı." },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as MobileRecordInput;
    const result = await ingestMobileAttendanceRecord(body, {
      broadcastSse: true,
      boundSicil
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

    if (result.status === "skipped") {
      return NextResponse.json(
        {
          success: false,
          syncedCount: 0,
          synced_count: 0,
          serverTimestamp: nowMs,
          server_timestamp: nowMs,
          status: "ERROR",
          message: result.reason
        },
        { status: 404 }
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
        detail: errorDetail(err)
      },
      { status: 500 }
    );
  }
}
