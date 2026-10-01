"use client";

import React from "react";

import { VerifiedMark } from "@/components/verified-mark";

import { BioModal } from "./bio-modal";

export function AboutCard({
  bio,
  followedByCount,
  hostIdentity,
  hostName,
  viewerIdentity,
}: {
  hostName: string;
  hostIdentity: string;
  viewerIdentity: string;
  bio: string | null;
  followedByCount: number;
}) {
  const hostAsViewer = `host-${hostIdentity}`;
  const isHost = viewerIdentity === hostAsViewer;

  const followedByLabel = followedByCount === 1 ? "người theo dõi" : "người theo dõi";

  return (
    <div className="px-4">
      <div className="group rounded-xl bg-background p-6 lg:p-10 flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2 font-semibold text-lg lg:text-2xl">
            Về {hostName}
            <VerifiedMark />
          </div>
          {isHost && <BioModal initialValue={bio} />}
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{followedByCount}</span>{" "}
          {followedByLabel}
        </div>
        <p className="text-sm">
          {bio || "Người dùng này thích giữ bí mật về bản thân."}
        </p>
      </div>
    </div>
  );
}
