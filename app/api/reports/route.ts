import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import {
  getStreamReports,
  getPendingReportCount,
  resolveReport,
} from "@/lib/report-service";
import { isModeratorOrOwner } from "@/lib/moderation-actions-service";

/**
 * GET /api/reports?streamId=X&status=PENDING — mod xem queue.
 * PATCH /api/reports — mod resolve/dismiss report.
 */
export async function GET(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get("streamId");
    const status = searchParams.get("status") ?? "PENDING";

    if (!streamId) {
      return NextResponse.json({ error: "streamId required" }, { status: 400 });
    }

    const hasAccess = await isModeratorOrOwner(self.id, streamId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [reports, pendingCount] = await Promise.all([
      getStreamReports(streamId, { status, limit: 50 }),
      getPendingReportCount(streamId),
    ]);

    return NextResponse.json({ reports, pendingCount });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unauthorized")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/reports] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const ResolveSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["RESOLVED", "DISMISSED"]),
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

    const parsed = ResolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { reportId, action } = parsed.data;

    // Load report để lấy streamId.
    const report = await db.messageReport.findUnique({
      where: { id: reportId },
      select: { streamId: true },
    });
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const hasAccess = await isModeratorOrOwner(self.id, report.streamId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await resolveReport({ reportId, modUserId: self.id, action });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unauthorized")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/reports] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
