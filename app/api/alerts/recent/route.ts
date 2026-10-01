import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import { db } from "@/lib/db";
import { getRecentAlerts } from "@/lib/recent-alerts-service";

/**
 * GET /api/alerts/recent?since=<ms>
 *
 * Polling endpoint cho streamer dashboard khi KHÔNG join LiveKit room.
 *
 * Trả về donations + subs xảy ra sau `since` timestamp.
 * Streamer dashboard gọi mỗi 5-10s và hiển thị toast.
 *
 * Auth: chỉ chính streamer của stream mới được gọi.
 */
export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const since = parseInt(searchParams.get("since") ?? "0", 10);

    // Map Clerk userId → internal User.
    const user = await db.user.findUnique({
      where: { externalUserId: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const alerts = await getRecentAlerts(user.id, since);
    return NextResponse.json({ alerts, serverTime: Date.now() });
  } catch (err) {
    console.error("[api/alerts/recent]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}