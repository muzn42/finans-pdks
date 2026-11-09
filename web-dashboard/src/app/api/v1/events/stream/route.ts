import { NextRequest } from "next/server";
import { sseHub } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // İstemci ayrıldı
        }
      };

      // Bazı kurumsal proxy / tarayıcı tamponları 4 KB altındaki ilk parçayı bekletir.
      // İlk olaydan önce yorum satırı dolgusu göndererek akışı hemen açarız.
      try {
        controller.enqueue(encoder.encode(`: ${" ".repeat(4096)}\n\n`));
      } catch {
        // Yoksay
      }

      send("connected", {
        status: "ok",
        serverTimeUtc: new Date().toISOString(),
        recentEvents: sseHub.getRecent().slice(0, 10)
      });

      const unsubscribe = sseHub.subscribe((evt) => {
        send("pdks_event", evt);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Zaten kapalı
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
