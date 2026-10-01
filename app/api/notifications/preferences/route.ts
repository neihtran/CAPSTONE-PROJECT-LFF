import { NextResponse } from "next/server";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import {
  getOrCreatePreferences,
  updatePreferences,
} from "@/lib/notification-service";

/**
 * GET/PATCH /api/notifications/preferences — user preferences.
 */
export async function GET() {
  try {
    const self = await getSelf();
    const pref = await getOrCreatePreferences(self.id);

    return NextResponse.json({
      onFollow: pref.onFollow,
      onLive: pref.onLive,
      onClip: pref.onClip,
      onModeration: pref.onModeration,
      onSystem: pref.onSystem,
      emailEnabled: pref.emailEnabled,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unauthorized")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/notifications/preferences] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const PatchSchema = z.object({
  onFollow: z.boolean().optional(),
  onLive: z.boolean().optional(),
  onClip: z.boolean().optional(),
  onModeration: z.boolean().optional(),
  onSystem: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
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

    const pref = await updatePreferences(self.id, parsed.data);

    return NextResponse.json({
      onFollow: pref.onFollow,
      onLive: pref.onLive,
      onClip: pref.onClip,
      onModeration: pref.onModeration,
      onSystem: pref.onSystem,
      emailEnabled: pref.emailEnabled,
    });
  } catch (error) {
    console.error("[api/notifications/preferences] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
