import React from "react";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { getUserByUsername } from "@/lib/user-service";
import { isFollowingUser } from "@/lib/follow-service";
import { isBlockedByUser } from "@/lib/block-service";
import { isModeratorOrOwner } from "@/lib/moderation-actions-service";
import { StreamPlayer } from "@/components/stream-player";
import { getStreamerTiers } from "@/lib/subscription-service";
import { getMySubscription } from "@/lib/subscription-service";
import { SubscriptionTiersGrid } from "@/components/subscriptions/subscription-card";
import { DonateButton, StickyDonateButton } from "@/components/donations/donate-modal";

interface UserPageProps {
  params: { username: string };
}

export async function generateMetadata({
  params: { username },
}: UserPageProps) {
  return {
    title: username,
  };
}

export default async function UserPage({
  params: { username },
}: UserPageProps) {
  const [user, externalUser] = await Promise.all([
    getUserByUsername(username),
    currentUser(),
  ]);

  if (!user || !user.stream) notFound();

  const [isFollowing, isBlocked] = await Promise.all([
    isFollowingUser(user.id),
    isBlockedByUser(user.id),
  ]);

  if (isBlocked) notFound();

  // Moderator check.
  const currentUserId = externalUser?.id ?? null;
  const isMod =
    currentUserId !== null &&
    (await isModeratorOrOwner(currentUserId, user.stream.id));

  // Fetch subscription tiers + viewer's current subscription.
  const [tiers, currentSub] = await Promise.all([
    getStreamerTiers(user.id),
    currentUserId ? getMySubscription(currentUserId, user.id) : Promise.resolve(null),
  ]);

  const hasTiers = tiers.length > 0;

  // Streamer không tự donate cho mình.
  const isSelf = currentUserId === user.externalUserId;

  return (
    <div className="w-full min-h-[calc(100vh-80px)]">
      {/* Stream player (full width). */}
      <StreamPlayer
        user={user}
        isFollowing={isFollowing}
        stream={user.stream}
        moderationInfo={{ isModerator: isMod, currentUserId }}
        viewerIsLoggedIn={currentUserId !== null}
      />

      {/* Subscription + Donate section — below stream. */}
      {hasTiers && (
        <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Ủng hộ {user.username}</h2>
              <p className="text-sm text-muted-foreground">
                Đăng ký subscription hoặc donate để ủng hộ streamer
              </p>
            </div>
            {currentUserId && (
              <DonateButton
                recipientId={user.id}
                recipientName={user.username}
                streamId={user.stream.id}
              />
            )}
          </div>

          <SubscriptionTiersGrid
            tiers={tiers.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              priceCents: t.priceCents,
              level: t.level,
              color: t.color,
              subscriberCount: t._count.subscriptions,
            }))}
            streamerId={user.id}
            currentSub={
              currentSub
                ? {
                    tierId: currentSub.tierId,
                    tierName: currentSub.tier.name,
                    status: currentSub.status,
                  }
                : null
            }
          />
        </div>
      )}

      {/* Sticky Donate FAB — luôn hiển thị ở góc dưới bên phải.
          Dùng cho viewer (không phải chính streamer) đang xem live stream
          → không cần scroll xuống dưới mới thấy nút donate. */}
      <StickyDonateButton
        recipientId={user.id}
        recipientName={user.username}
        streamId={user.stream.id}
        viewerIsLoggedIn={currentUserId !== null}
        isSelf={isSelf}
      />
    </div>
  );
}
