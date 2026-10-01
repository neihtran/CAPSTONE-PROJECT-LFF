import { NextResponse } from "next/server";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import {
  subscribeToTier,
  cancelSubscription,
  getMySubscription,
} from "@/lib/subscription-service";

/**
 * GET /api/subscriptions/me?streamerId=xxx
 *    → subscription hiện tại của user với streamer đó.
 *
 * POST /api/subscriptions/me → subscribe theo tier.
 *    Body: { streamerId, tierId }
 *
 * DELETE /api/subscriptions/me?streamerId=xxx
 *    → cancel subscription.
 */
export async function GET(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const streamerId = searchParams.get("streamerId");

    if (!streamerId) {
      return NextResponse.json({ error: "Missing streamerId" }, { status: 400 });
    }

    const sub = await getMySubscription(self.id, streamerId);
    return NextResponse.json({
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            tierId: sub.tierId,
            tierName: sub.tier.name,
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            monthsActive: sub.monthsActive,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/subscriptions/me] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const SubscribeSchema = z.object({
  streamerId: z.string().uuid(),
  tierId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const self = await getSelf();

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await subscribeToTier({
      subscriberId: self.id,
      streamerId: parsed.data.streamerId,
      tierId: parsed.data.tierId,
    });

    return NextResponse.json({
      subscriptionId: result.id,
      paymentRef: result.paymentRef,
      currentPeriodEnd: result.currentPeriodEnd.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/subscriptions/me] POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const streamerId = searchParams.get("streamerId");

    if (!streamerId) {
      return NextResponse.json({ error: "Missing streamerId" }, { status: 400 });
    }

    await cancelSubscription(self.id, streamerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/subscriptions/me] DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
