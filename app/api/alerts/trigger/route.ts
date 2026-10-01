import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/alerts/trigger
 *
 * Trigger an alert event (called by client after successful action).
 * In production, this would go through LiveKit data channel or SSE.
 *
 * Body: {
 *   type: "FOLLOW" | "SUBSCRIBE" | "DONATION" | "CLIP"
 *   streamerId: string
 *   username: string
 *   displayName?: string
 *   amountCents?: number
 *   tierName?: string
 *   message?: string
 * }
 *
 * Production upgrade: replace with LiveKit dataChannel broadcast.
 */
const AlertSchema = z.object({
  type: z.enum(["FOLLOW", "SUBSCRIBE", "DONATION", "RAID", "CLIP"]),
  streamerId: z.string().uuid(),
  username: z.string().min(1).max(50),
  displayName: z.string().max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
  tierName: z.string().max(50).optional(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = AlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { buildAlert } = await import("@/lib/alert-service");
    const alert = await buildAlert({
      streamerId: parsed.data.streamerId,
      type: parsed.data.type as "FOLLOW" | "SUBSCRIBE" | "DONATION" | "CLIP",
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      amountCents: parsed.data.amountCents,
      tierName: parsed.data.tierName,
      message: parsed.data.message,
    });

    if (!alert) {
      // Alert disabled by streamer.
      return NextResponse.json({ alert: null, reason: "disabled" });
    }

    return NextResponse.json({ alert, success: true }, { status: 200 });
  } catch (error) {
    console.error("[api/alerts/trigger] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
