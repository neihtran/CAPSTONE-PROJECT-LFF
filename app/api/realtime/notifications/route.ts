import { currentUser } from "@clerk/nextjs";

import {
  addSubscription,
  removeSubscription,
} from "@/lib/realtime";
import { getSelf } from "@/lib/auth-service";

/**
 * GET /api/realtime/notifications — Server-Sent Events endpoint.
 *
 * Client opens EventSource() → server push notification updates real-time.
 *
 * Auth: phải login. Lấy currentUser từ Clerk.
 *
 * Heartbeat: gửi `: ping\n\n` mỗi 30s để giữ connection alive.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let userId: string;
  try {
    const self = await getSelf();
    userId = self.id;
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify with Clerk too (double check).
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Register subscription.
      addSubscription(userId, controller);

      // Initial connect event.
      controller.enqueue(
        encoder.encode(`event: connected\ndata: {"userId":"${userId}"}\n\n`)
      );

      // Heartbeat mỗi 30s.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Cleanup khi client disconnect.
      const cleanup = () => {
        clearInterval(heartbeat);
        removeSubscription(userId, controller);
        try {
          controller.close();
        } catch {
          // ignore — đã close rồi
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
