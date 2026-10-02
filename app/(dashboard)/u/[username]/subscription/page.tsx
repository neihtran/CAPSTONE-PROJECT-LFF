import React from "react";
import { redirect } from "next/navigation";

import { getSelfByUsername } from "@/lib/auth-service";
import {
  getStreamerTiers,
  createTier,
  updateTier,
  disableTier,
  getStreamerSubscriptions,
  getStreamerSubscriptionRevenue,
} from "@/lib/subscription-service";
import { SubscriptionDashboard } from "@/components/subscriptions/subscription-dashboard";

interface SubscriptionPageProps {
  params: { username: string };
}

/**
 * /u/[username]/subscription — quản lý subscription tiers (streamer dashboard).
 */
export default async function SubscriptionPage({ params: { username } }: SubscriptionPageProps) {
  const self = await getSelfByUsername(username);
  if (!self) redirect("/");

  const [tiers, subscriptions, revenue] = await Promise.all([
    getStreamerTiers(self.id),
    getStreamerSubscriptions(self.id, { limit: 50 }),
    getStreamerSubscriptionRevenue(self.id),
  ]);

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 lg:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Gói đăng ký</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý gói đăng ký và xem người đã đăng ký của bạn
        </p>
      </div>

      <SubscriptionDashboard
        streamerId={self.id}
        initialTiers={tiers.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priceCents: t.priceCents,
          level: t.level,
          color: t.color,
          status: t.status,
          subscriberCount: t._count.subscriptions,
        }))}
        initialSubscribers={subscriptions.map((s) => ({
          id: s.id,
          status: s.status,
          subscriberUsername: s.subscriber.username,
          subscriberImageUrl: s.subscriber.imageUrl,
          tierName: s.tier.name,
          tierColor: s.tier.color,
          monthsActive: s.monthsActive,
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
          createdAt: s.createdAt.toISOString(),
        }))}
        totalRevenueCents={revenue}
      />
    </div>
  );
}
