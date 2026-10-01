"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";

type NotificationItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  actor: { id: string; username: string; imageUrl: string } | null;
};

/**
 * NotificationsList — full list page.
 * Auto-mark all read đã xử lý ở server page.
 * Click item → navigate + mark read.
 */
export function NotificationsList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (n: NotificationItem) => {
    if (n.linkUrl) {
      startTransition(() => router.push(n.linkUrl!));
    }
  };

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        Chưa có thông báo nào.
      </Card>
    );
  }

  // Group by date.
  const groups = new Map<string, NotificationItem[]>();
  for (const n of items) {
    const date = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) key = "Hôm nay";
    else if (date.toDateString() === yesterday.toDateString())
      key = "Hôm qua";
    else key = date.toLocaleDateString("vi-VN");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([date, group]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground sticky top-14 bg-background/95 backdrop-blur py-2 z-10">
            {date}
          </h3>
          <div className="space-y-1">
            {group.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onClick={() => handleClick(n)}
                disabled={isPending}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationRow({
  notification: n,
  onClick,
  disabled,
}: {
  notification: NotificationItem;
  onClick: () => void;
  disabled: boolean;
}) {
  const isUnread = n.status === "UNREAD";

  const typeIcon: Record<string, string> = {
    FOLLOW: "👤",
    LIVE: "🔴",
    CLIP: "✂️",
    MODERATION: "⚠️",
    SYSTEM: "📢",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full text-left items-start gap-x-3 p-3 rounded-lg border transition-colors",
        "hover:bg-muted/50",
        isUnread && "bg-primary/5 border-primary/30"
      )}
    >
      {n.actor ? (
        <UserAvatar
          username={n.actor.username}
          imageUrl={n.actor.imageUrl}
          isLive={false}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
          {typeIcon[n.type] ?? "📬"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-x-2">
          <p className="text-sm font-semibold">{n.title}</p>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{n.body}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
