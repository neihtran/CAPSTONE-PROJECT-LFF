import { NextResponse } from "next/server";
import { z } from "zod";
import { getSelf } from "@/lib/auth-service";
import {
  getStreamerTiers,
  createTier,
  updateTier,
  disableTier,
  getStreamerSubscriptions,
  getStreamerSubscriptionRevenue,
} from "@/lib/subscription-service";

/**
 * GET /api/subscriptions/tiers?streamerId=xxx
 *    → tiers của streamer (public, kể cả khi chưa login).
 *
 * GET /api/subscriptions/tiers
 *    → tiers của streamer hiện tại (login required).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const streamerId = searchParams.get("streamerId");

  if (streamerId) {
    // Public — xem tiers của streamer.
    const tiers = await getStreamerTiers(streamerId);
    return NextResponse.json({
      items: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        priceCents: t.priceCents,
        level: t.level,
        color: t.color,
        subscriberCount: t._count.subscriptions,
      })),
    });
  }

  // Authenticated — xem tiers của chính mình.
  try {
    const self = await getSelf();
    const tiers = await getStreamerTiers(self.id);
    return NextResponse.json({
      items: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        priceCents: t.priceCents,
        level: t.level,
        color: t.color,
        subscriberCount: t._count.subscriptions,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const CreateTierSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(10_000).max(10_000_000),
  level: z.number().int().min(1).max(10),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const UpdateTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(10_000).max(10_000_000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

/**
 * POST /api/subscriptions/tiers → tạo tier mới.
 * PATCH /api/subscriptions/tiers/:id → update tier.
 * DELETE /api/subscriptions/tiers/:id → disable tier.
 */
export async function POST(request: Request) {
  try {
    const self = await getSelf();

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = CreateTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const tier = await createTier({ ...parsed.data, streamerId: self.id });
    return NextResponse.json({ id: tier.id, name: tier.name, priceCents: tier.priceCents }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/subscriptions/tiers] POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get("id");

    if (!tierId) {
      return NextResponse.json({ error: "Missing tier id" }, { status: 400 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = UpdateTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateTier(tierId, self.id, parsed.data);
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/subscriptions/tiers] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get("id");

    if (!tierId) {
      return NextResponse.json({ error: "Missing tier id" }, { status: 400 });
    }

    const result = await disableTier(tierId, self.id);
    return NextResponse.json({ disabled: result.count });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/subscriptions/tiers] DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
