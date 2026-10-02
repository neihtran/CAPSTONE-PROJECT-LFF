import React from "react";
import { currentUser } from "@clerk/nextjs/server";

import { getUserByUsername } from "@/lib/user-service";
import { StreamPlayer } from "@/components/stream-player";

import { EndLiveFab } from "./_components/end-live-fab";

export default async function CreatorPage({
  params: { username },
}: {
  params: { username: string };
}) {
  const externalUser = await currentUser();
  const user = await getUserByUsername(username);

  if (!user || user.externalUserId !== externalUser?.id || !user.stream) {
    throw new Error("Unauthorized");
  }

  // Streamer xem trang của mình → luôn là moderator (owner).
  const moderationInfo = {
    isModerator: true,
    currentUserId: externalUser?.id ?? null,
  };

  return (
    <div className="h-full">
      <StreamPlayer
        user={user}
        stream={user.stream}
        isFollowing={true}
        moderationInfo={moderationInfo}
        viewerIsLoggedIn={!!externalUser}
      />
      {/* Nổi góc phải-dưới: cho phép end live mà không cần rời trang. */}
      <EndLiveFab streamId={user.stream.id} isLive={user.stream.isLive} />
    </div>
  );
}
