import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import {
  saveSubscription,
  removeSubscription,
} from "@/lib/push-service";

/**
 * POST /api/push/subscribe
 *
 * Save user's push subscription.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { endpoint, keys, userAgent } = body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Missing fields: endpoint, keys.p256dh, keys.auth" },
        { status: 400 }
      );
    }

    // Map Clerk userId to internal user.
    const user = await db.user.findUnique({
      where: { externalUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sub = await saveSubscription({
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });

    return NextResponse.json({ success: true, id: sub.id });
  } catch (err) {
    console.error("[push/subscribe] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 *
 * Remove user's push subscription (when user unsubscribes).
 */
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const removed = await removeSubscription(endpoint);
    return NextResponse.json({ success: removed });
  } catch (err) {
    console.error("[push/unsubscribe] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
