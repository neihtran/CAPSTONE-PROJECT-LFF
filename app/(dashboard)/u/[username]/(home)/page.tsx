import React from "react";
import { currentUser } from "@clerk/nextjs";

import { getUserByUsername } from "@/lib/user-service";
import { StreamPlayer } from "@/components/stream-player";

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
    </div>
  );
}
