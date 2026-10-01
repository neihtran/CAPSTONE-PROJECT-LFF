import { NextResponse } from "next/server";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import {
  getUnreadCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-service";
import { isAppError } from "@/lib/errors";

/**
 * GET /api/notifications — list notifications của current user.
 * GET /api/notifications?unread=true → chỉ unread.
 * GET /api/notifications?count=true → chỉ count (cho bell badge).
 *
 * PATCH /api/notifications — mark 1 hoặc all là đã đọc.
 */
export async function GET(request: Request) {
  try {
    const self = await getSelf();

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("count") === "true";
    const onlyUnread = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    if (countOnly) {
      const count = await getUnreadCount(self.id);
      return NextResponse.json({ count });
    }

    const items = await listMyNotifications(self.id, {
      limit: Math.min(50, Math.max(1, limit)),
      offset: Math.max(0, offset),
      onlyUnread,
    });

    const total = await getUnreadCount(self.id);

    return NextResponse.json({
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        status: n.status,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        metadata: n.metadata,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        actor: n.actor,
      })),
      unreadCount: total,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unauthorized")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/notifications] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const PatchSchema = z
  .object({
    notificationId: z.string().uuid().optional(),
    markAll: z.boolean().optional(),
  })
  .refine((d) => d.notificationId || d.markAll, {
    message: "Cần notificationId hoặc markAll=true",
  });

export async function PATCH(request: Request) {
  try {
    const self = await getSelf();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if (parsed.data.markAll) {
      const count = await markAllNotificationsRead(self.id);
      return NextResponse.json({ success: true, count });
    }

    if (parsed.data.notificationId) {
      await markNotificationRead({
        notificationId: parsed.data.notificationId,
        userId: self.id,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  } catch (error) {
    if (isAppError(error)) throw error;
    console.error("[api/notifications] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
