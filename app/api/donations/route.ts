import { NextResponse } from "next/server";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import { db } from "@/lib/db";
import { createDonation, getRecentDonations, getMyDonations } from "@/lib/donation-service";

/**
 * GET /api/donations/recent?streamerId=xxx
 *    → recent donations của streamer (public, last 30).
 *
 * GET /api/donations/me
 *    → donations của user hiện tại.
 *
 * POST /api/donations
 *    → tạo donation (stub payment).
 *    Body: { recipientId, amountCents, streamId?, message? }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const streamerId = searchParams.get("streamerId");
  const me = searchParams.get("me") === "true";

  if (me) {
    try {
      const self = await getSelf();
      const donations = await getMyDonations(self.id);
      return NextResponse.json({
        items: donations.map((d) => ({
          id: d.id,
          amountCents: d.amountCents,
          message: d.message,
          createdAt: d.createdAt.toISOString(),
          recipient: d.recipient,
          stream: d.stream,
        })),
      });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (streamerId) {
    const donations = await getRecentDonations(streamerId);
    return NextResponse.json({
      items: donations.map((d) => ({
        id: d.id,
        amountCents: d.amountCents,
        message: d.message,
        createdAt: d.createdAt.toISOString(),
        donor: d.donor,
        stream: d.stream,
      })),
    });
  }

  return NextResponse.json({ error: "Missing streamerId or me=true" }, { status: 400 });
}

const DonationSchema = z.object({
  recipientId: z.string().uuid(),
  amountCents: z.number().int().min(1_000).max(10_000_000),
  streamId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const self = await getSelf();

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = DonationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createDonation({
      donorId: self.id,
      recipientId: parsed.data.recipientId,
      amountCents: parsed.data.amountCents,
      streamId: parsed.data.streamId,
      message: parsed.data.message,
    });

    return NextResponse.json({
      id: result.id,
      paymentRef: result.paymentRef,
      status: result.status,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/donations] POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
