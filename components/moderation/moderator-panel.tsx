"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeratorsList } from "./moderators-list";
import { ModLogTable } from "./mod-log-table";
import { BannedWordsManager } from "./banned-words-manager";

type Moderator = {
  userId: string;
  username: string;
  imageUrl: string;
  bio: string | null;
  addedAt: string;
};

type ModLogEntry = {
  id: string;
  type: string;
  createdAt: string;
  expiresAt: string | null;
  reason: string | null;
  targetUser: { id: string; username: string; imageUrl: string };
  actorUser: { id: string; username: string; imageUrl: string };
};

type BannedWord = {
  id: string;
  pattern: string;
  action: "REJECT" | "FILTER";
  reason: string | null;
};

/**
 * ModeratorPanel — container với 3 tabs:
 *
 *   - Moderators: danh sách + add/remove.
 *   - Mod Log: lịch sử timeout/ban/delete.
 *   - AutoMod: banned words list + add/remove.
 *
 * Owner thấy tất cả, moderator chỉ thấy Mod Log + AutoMod read-only.
 */
export function ModeratorPanel({
  streamId,
  ownerUsername,
  isOwner,
  moderators,
  modLog,
  bannedWords,
}: {
  streamId: string;
  ownerUsername: string;
  isOwner: boolean;
  moderators: Moderator[];
  modLog: ModLogEntry[];
  bannedWords: BannedWord[];
}) {
  return (
    <Tabs defaultValue="moderators" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="moderators">
          Moderators ({moderators.length})
        </TabsTrigger>
        <TabsTrigger value="log">Mod log ({modLog.length})</TabsTrigger>
        <TabsTrigger value="automod">
          AutoMod ({bannedWords.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="moderators" className="space-y-4">
        <Card className="p-6">
          <ModeratorsList
            streamId={streamId}
            ownerUsername={ownerUsername}
            isOwner={isOwner}
            moderators={moderators}
          />
        </Card>
      </TabsContent>

      <TabsContent value="log" className="space-y-4">
        <Card className="p-6">
          <ModLogTable entries={modLog} />
        </Card>
      </TabsContent>

      <TabsContent value="automod" className="space-y-4">
        <Card className="p-6">
          <BannedWordsManager
            streamId={streamId}
            ownerUsername={ownerUsername}
            isOwner={isOwner}
            bannedWords={bannedWords}
          />
        </Card>
      </TabsContent>
    </Tabs>
  );
}
