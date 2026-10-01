import { headers } from "next/headers";
import { WebhookReceiver } from "livekit-server-sdk";

import { db } from "@/lib/db";
import { startStreamSession, endStreamSession } from "@/lib/analytics-service";

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = headers();
  const authorization = headerPayload.get("Authorization");

  if (!authorization) {
    return new Response("Error occured -- no authorization headers", {
      status: 400,
    });
  }

  const event = receiver.receive(body, authorization);

  if (event.event === "ingress_started") {
    const updated = await db.stream.update({
      where: {
        ingressId: event.ingressInfo?.ingressId,
      },
      data: {
        isLive: true,
      },
      select: {
        id: true,
        name: true,
        userId: true,
        user: { select: { username: true } },
      },
    });

    // Tạo StreamSession mới.
    try {
      await startStreamSession(updated.id);
    } catch (err) {
      console.warn("[webhook/livekit] startStreamSession failed:", err);
    }

    // Trigger LIVE notifications cho followers.
    try {
      const followers = await db.follow.findMany({
        where: { followingId: updated.userId },
        select: { followerId: true },
      });

      const { notifyLiveStream } = await import("@/lib/notification-service");
      await notifyLiveStream({
        streamerId: updated.userId,
        streamerUsername: updated.user.username,
        streamName: updated.name,
        followerIds: followers.map((f) => f.followerId),
      });
    } catch (err) {
      console.warn("[webhook/livekit] notifyLiveStream failed:", err);
    }
  }

  if (event.event === "ingress_ended") {
    const stream = await db.stream.findFirst({
      where: {
        ingressId: event.ingressInfo?.ingressId,
      },
      select: { id: true },
    });

    await db.stream.update({
      where: {
        ingressId: event.ingressInfo?.ingressId,
      },
      data: {
        isLive: false,
      },
    });

    // End session — query stats từ DB.
    if (stream) {
      const session = await db.streamSession.findFirst({
        where: { streamId: stream.id, endedAt: null },
        orderBy: { startedAt: "desc" },
      });

      if (session) {
        try {
          await endStreamSession(session.id, {
            peakViewers: 0, // TODO: track via LiveKit API
            totalViews: 0,
            uniqueViewers: 0,
            donationCents: 0,
            newSubscribers: 0,
          });
        } catch (err) {
          console.warn("[webhook/livekit] endStreamSession failed:", err);
        }
      }
    }
  }

  return new Response("Success!", { status: 200 });
}
