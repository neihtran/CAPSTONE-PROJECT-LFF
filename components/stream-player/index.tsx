"use client";

import React from "react";
import { LiveKitRoom } from "@livekit/components-react";

import { useViewerToken } from "@/hooks/use-viewer-token";
import { useChatSidebar } from "@/store/use-chat-sidebar";
import { cn } from "@/lib/utils";

import { ChatToggle } from "./chat-toggle";
import { InfoCard } from "./info-card";
import { AboutCard } from "./about-card";
import { Video, VideoSkeleton } from "./video";
import { Chat, ChatSkeleton } from "./chat";
import { Header, HeaderSkeleton } from "./header";
import { ClipsSection } from "@/components/clips/clips-section";
import { AlertQueue } from "@/components/alerts/alert-queue";

type CustomStream = {
  id: string;
  isChatEnabled: boolean;
  isChatDelayed: boolean;
  isChatFollowersOnly: boolean;
  isLive: boolean;
  thumbnailUrl: string | null;
  name: string;
};

type CustomUser = {
  id: string;
  username: string;
  bio: string | null;
  stream: CustomStream | null;
  imageUrl: string;
  _count: {
    followedBy: number;
  };
};

type ModerationInfo = {
  isModerator: boolean;
  currentUserId: string | null;
};

export function StreamPlayer({
  user,
  stream,
  isFollowing,
  moderationInfo,
  viewerIsLoggedIn,
}: {
  user: CustomUser;
  stream: CustomStream;
  isFollowing: boolean;
  moderationInfo?: ModerationInfo;
  viewerIsLoggedIn: boolean;
}) {
  const { identity, name, token } = useViewerToken(user.id);
  const { collapsed } = useChatSidebar((state) => state);

  const modInfo: ModerationInfo = moderationInfo ?? {
    isModerator: false,
    currentUserId: null,
  };

  if (!token || !identity || !name) {
    return <StreamPlayerSkeleton />;
  }

  return (
    <>
      {collapsed && (
        <div className="hidden lg:block fixed top-[100px] right-2 z-50">
          <ChatToggle />
        </div>
      )}
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_WS_URL}
        className={cn(
          "grid grid-cols-1 lg:grid-cols-3 h-full w-full",
          collapsed && "lg:grid-cols-2"
        )}
      >
        {/* Alert overlay — fixed position, shows on top of video */}
        <div className="fixed inset-0 pointer-events-none z-[90]">
          <AlertQueue hostIdentity={user.id} />
        </div>

        <div className="space-y-4 col-span-1 lg:col-span-2 lg:overflow-y-auto hidden-scrollbar pb-10">
          <Video
            hostName={user.username}
            hostIdentity={user.id}
            isOwner={modInfo.isModerator}
          />
          <Header
            imageUrl={user.imageUrl}
            hostName={user.username}
            hostIdentity={user.id}
            isFollowing={isFollowing}
            name={stream.name}
            viewerIdentity={identity}
          />
          <InfoCard
            hostIdentity={user.id}
            viewerIdentity={identity}
            name={stream.name}
            thumbnailUrl={stream.thumbnailUrl}
          />
          <AboutCard
            hostName={user.username}
            hostIdentity={user.id}
            viewerIdentity={identity}
            bio={user.bio}
            followedByCount={user._count.followedBy}
          />
          <ClipsSection
            streamId={stream.id}
            streamUserId={user.id}
            streamName={user.username}
            videoUrl={`${process.env.NEXT_PUBLIC_LIVEKIT_WS_URL ?? ""}/hls/${user.id}/index.m3u8`}
            isLoggedIn={viewerIsLoggedIn}
          />
        </div>
        <div className={cn("col-span-1", collapsed && "hidden lg:hidden")}>
          <Chat
            viewerName={name}
            hostName={user.username}
            hostIdentity={user.id}
            isFollowing={isFollowing}
            isChatEnabled={stream.isChatEnabled}
            isChatDelayed={stream.isChatDelayed}
            isChatFollowersOnly={stream.isChatFollowersOnly}
            streamId={stream.id}
            isModerator={modInfo.isModerator}
            currentUserId={modInfo.currentUserId}
          />
        </div>
      </LiveKitRoom>
    </>
  );
}

export function StreamPlayerSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:gap-y-0 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 h-full">
      <div className="space-y-4 col-span-1 lg:col-span-2 xl:col-span-2 2xl:col-span-5 lg:overflow-y-auto hidden-scrollbar pb-10">
        <VideoSkeleton />
        <HeaderSkeleton />
      </div>
      <div className="col-span-1 bg-background">
        <ChatSkeleton />
      </div>
    </div>
  );
}
