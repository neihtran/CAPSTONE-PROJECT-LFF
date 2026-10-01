import React, { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getUserByUsername } from "@/lib/user-service";
import {
  getModLog,
  getStreamModerators,
} from "@/lib/moderation-actions-service";
import { db } from "@/lib/db";
import { ModeratorPanel } from "@/components/moderation/moderator-panel";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard /u/[username]/moderation — cho streamer + moderator quản lý:
 *
 *   1. Danh sách moderators (owner thêm/xóa).
 *   2. Lịch sử hành động mod (timeout/ban/delete).
 *   3. AutoMod banned words (chỉ owner).
 *
 * Layout: 2 cột — left: list + actions; right: log.
 */
export const dynamic = "force-dynamic";

export default async function ModerationDashboardPage({
  params: { username },
}: {
  params: { username: string };
}) {
  const externalUser = await currentUser();
  const user = await getUserByUsername(username);

  if (!user || user.externalUserId !== externalUser?.id || !user.stream) {
    redirect("/");
  }

  const streamId = user.stream.id;

  // Lấy data song song.
  const [moderators, modLog, bannedWords] = await Promise.all([
    getStreamModerators(streamId),
    getModLog(streamId, { limit: 50 }),
    db.bannedWord.findMany({
      where: { streamId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Moderation</h1>
        <p className="text-muted-foreground text-sm">
          Quản lý moderators, xem lịch sử timeout/ban, và cấu hình AutoMod
          (banned words).
        </p>
      </div>

      <Suspense fallback={<ModerationSkeleton />}>
        <ModeratorPanel
          streamId={streamId}
          ownerUsername={username}
          isOwner={true /* dashboard là owner mới vào được */}
          moderators={moderators.map((m) => ({
            userId: m.user.id,
            username: m.user.username,
            imageUrl: m.user.imageUrl,
            bio: m.user.bio,
            addedAt: m.createdAt.toISOString(),
          }))}
          modLog={modLog.map((entry) => ({
            id: entry.id,
            type: entry.type,
            createdAt: entry.createdAt.toISOString(),
            expiresAt: entry.expiresAt?.toISOString() ?? null,
            reason: entry.reason,
            targetUser: {
              id: entry.targetUser.id,
              username: entry.targetUser.username,
              imageUrl: entry.targetUser.imageUrl,
            },
            actorUser: {
              id: entry.actorUser.id,
              username: entry.actorUser.username,
              imageUrl: entry.actorUser.imageUrl,
            },
          }))}
          bannedWords={bannedWords.map((bw) => ({
            id: bw.id,
            pattern: bw.pattern,
            action: bw.action as "REJECT" | "FILTER",
            reason: bw.reason,
          }))}
        />
      </Suspense>
    </div>
  );
}

function ModerationSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
