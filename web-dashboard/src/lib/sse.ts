/**
 * Server-Sent Events (SSE) Canlı Yayın Merkezi
 * Giriş/çıkış (checkIn/checkOut), gün içi ara geçiş (AccessLogs),
 * izin onayları, personel CRUD ve 30m geofence güvenlik alarmlarını
 * bağlı tüm istemcilere sayfa yenilenmeden (real-time) iletir.
 */

export interface SseEventPayload {
  id: string;
  type:
    | "ACCESS_LOG"
    | "ATTENDANCE_UPDATE"
    | "LEAVE_UPDATE"
    | "SECURITY_ALERT"
    | "EMPLOYEE_CRUD"
    | "SHIFT_UPDATE"
    | "LATE_REASON_UPDATE";
  title: string;
  message: string;
  severity?: "info" | "ok" | "warn" | "bad";
  data?: Record<string, unknown>;
  timestampUtc: string;
}

type SseListener = (event: SseEventPayload) => void;

class SseHub {
  private listeners = new Set<SseListener>();
  private recentEvents: SseEventPayload[] = [];

  subscribe(listener: SseListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(
    event: Omit<SseEventPayload, "id" | "timestampUtc">
  ): SseEventPayload {
    const fullEvent: SseEventPayload = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestampUtc: new Date().toISOString()
    };
    this.recentEvents = [fullEvent, ...this.recentEvents.slice(0, 29)];
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Bağlantısı kopmuş istemcileri sessizce atla
      }
    }
    return fullEvent;
  }

  getRecent(): SseEventPayload[] {
    return this.recentEvents;
  }

  getClientCount(): number {
    return this.listeners.size;
  }
}

const globalForSse = globalThis as unknown as { sseHub?: SseHub };
export const sseHub = globalForSse.sseHub ?? new SseHub();
if (process.env.NODE_ENV !== "production") {
  globalForSse.sseHub = sseHub;
}
