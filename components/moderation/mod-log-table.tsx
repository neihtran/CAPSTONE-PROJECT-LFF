"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Entry = {
  id: string;
  type: string;
  createdAt: string;
  expiresAt: string | null;
  reason: string | null;
  targetUser: { id: string; username: string; imageUrl: string };
  actorUser: { id: string; username: string; imageUrl: string };
};

/**
 * Mod Log Table — hiển thị lịch sử các hành động moderation.
 *
 * Có thể filter theo type (TIMEOUT / BAN / UNBAN / DELETE_MESSAGE).
 */
export function ModLogTable({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<string>("ALL");

  const filtered =
    filter === "ALL" ? entries : entries.filter((e) => e.type === filter);

  const stats = {
    TIMEOUT: entries.filter((e) => e.type === "TIMEOUT").length,
    BAN: entries.filter((e) => e.type === "BAN").length,
    UNBAN: entries.filter((e) => e.type === "UNBAN").length,
    DELETE_MESSAGE: entries.filter((e) => e.type === "DELETE_MESSAGE").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mod Log</h3>
        <div className="text-xs text-muted-foreground">
          Tổng: {entries.length} hành động
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-2">
        <StatChip label="Timeout" count={stats.TIMEOUT} color="yellow" />
        <StatChip label="Ban" count={stats.BAN} color="red" />
        <StatChip label="Unban" count={stats.UNBAN} color="green" />
        <StatChip label="Delete Msg" count={stats.DELETE_MESSAGE} color="gray" />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "TIMEOUT", "BAN", "UNBAN", "DELETE_MESSAGE"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === type
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Không có hành động nào.
          </p>
        ) : (
          filtered.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function LogEntry({ entry }: { entry: Entry }) {
  const typeColor: Record<string, string> = {
    TIMEOUT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    BAN: "bg-red-500/10 text-red-600 border-red-500/20",
    UNBAN: "bg-green-500/10 text-green-600 border-green-500/20",
    DELETE_MESSAGE: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };

  const typeLabel: Record<string, string> = {
    TIMEOUT: "Timeout",
    BAN: "Ban",
    UNBAN: "Unban",
    DELETE_MESSAGE: "Xóa tin nhắn",
  };

  return (
    <div className="flex items-center gap-x-3 p-2.5 border rounded-md text-sm hover:bg-muted/30 transition-colors">
      <Badge
        variant="outline"
        className={`${typeColor[entry.type]} font-medium text-[10px]`}
      >
        {typeLabel[entry.type] ?? entry.type}
      </Badge>

      <div className="flex-1 min-w-0">
        <p className="text-xs">
          <span className="font-medium">@{entry.actorUser.username}</span>
          {" → "}
          <span className="font-medium">@{entry.targetUser.username}</span>
          {entry.expiresAt && (
            <span className="text-muted-foreground">
              {" "}
              · đến {new Date(entry.expiresAt).toLocaleString("vi-VN")}
            </span>
          )}
        </p>
        {entry.reason && (
          <p className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">
            Lý do: {entry.reason}
          </p>
        )}
      </div>

      <span className="text-xs text-muted-foreground flex-shrink-0">
        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

function StatChip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "yellow" | "red" | "green" | "gray";
}) {
  const colorClass: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    red: "bg-red-500/10 text-red-600 border-red-500/30",
    green: "bg-green-500/10 text-green-600 border-green-500/30",
    gray: "bg-gray-500/10 text-gray-600 border-gray-500/30",
  };

  return (
    <div className={`border rounded-md px-3 py-2 ${colorClass[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
