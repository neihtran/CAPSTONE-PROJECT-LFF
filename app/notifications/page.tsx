import React from "react";
import { redirect } from "next/navigation";

import { listMyNotifications, markAllNotificationsRead } from "@/lib/notification-service";
import { getSelf } from "@/lib/auth-service";
import { NotificationsList } from "@/components/notifications/notifications-list";

/**
 * /notifications — list tất cả notifications của user.
 *
 * Auto-mark all read khi user mở page (như Gmail behavior).
 */
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  let self;
  try {
    self = await getSelf();
  } catch {
    redirect("/sign-in");
  }

  // Auto-mark all read.
  await markAllNotificationsRead(self.id);

  const items = await listMyNotifications(self.id, { limit: 50 });

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Thông báo</h1>
        <p className="text-sm text-muted-foreground">
          Tất cả thông báo của bạn gần đây.
        </p>
      </div>

      <NotificationsList
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          status: n.status,
          title: n.title,
          body: n.body,
          linkUrl: n.linkUrl,
          createdAt: n.createdAt.toISOString(),
          actor: n.actor,
        }))}
      />
    </div>
  );
}
