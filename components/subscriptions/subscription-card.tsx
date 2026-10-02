"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getTierStyle, TierEffects, TierBadgeLabel } from "./tier-effects";

type Tier = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  level: number;
  color: string;
  subscriberCount: number;
};

const LEVEL_COLORS: Record<number, string> = {
  1: "#CD7F32", // Bronze
  2: "#C0C0C0", // Silver
  3: "#FFD700", // Gold
  4: "#9146FF", // Purple
};

/**
 * SubscriptionCard — hiển thị 1 tier trên profile page.
 *
 * Click "Subscribe" → POST /api/subscriptions/me.
 * Nếu đã sub → hiển thị badge + "Subscribed" + Cancel button.
 */
export function SubscriptionCard({
  tier,
  streamerId,
  currentSub,
}: {
  tier: Tier;
  streamerId: string;
  currentSub: {
    tierId: string;
    tierName: string;
    status: string;
    currentPeriodEnd?: string | Date;
  } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const isCurrentTier = currentSub?.tierId === tier.id;
  const isSubscribed =
    isCurrentTier && (currentSub?.status === "ACTIVE" || currentSub?.status === "CANCELED");
  const isCanceled = isCurrentTier && currentSub?.status === "CANCELED";

  const handleSubscribe = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscriptions/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamerId, tierId: tier.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Subscribe failed");
        toast.success(`Subscribed to ${tier.name}!`);
        // Trigger page refresh.
        window.location.reload();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Subscribe failed"
        );
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/subscriptions/me?streamerId=${streamerId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Cancel failed");
        toast.success("Subscription canceled");
        window.location.reload();
      } catch {
        toast.error("Không thể cancel subscription");
      }
    });
  };

  const badgeColor =
    tier.color ?? LEVEL_COLORS[tier.level] ?? "#9146FF";
  const tierStyle = getTierStyle(tier.level);

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 space-y-3 flex flex-col overflow-hidden transition-transform hover:scale-[1.02] hover:-translate-y-0.5",
        tierStyle.bg,
        tierStyle.border,
        tierStyle.glow
      )}
    >
      {/* Effects overlay (shimmer/sparkle/rainbow border) */}
      <TierEffects level={tier.level} badgeColor={badgeColor} />

      {/* Content wrapper — relative + z-index để effects overlay không che text */}
      <div className="relative z-10 space-y-3 flex flex-col">
        <div className="flex items-start justify-between">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: badgeColor }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
              />
              {tier.name} <span className="opacity-60 ml-1">· {TierBadgeLabel(tier.level)}</span>
            </div>
            {tier.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {tier.description}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{formatVND(tier.priceCents)}</p>
            <p className="text-xs text-muted-foreground">/ tháng</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>👥 {tier.subscriberCount} subscriber{tier.subscriberCount !== 1 ? "s" : ""}</span>
        </div>

        {isSubscribed ? (
          <div className="space-y-2 mt-auto">
            <div
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium ${
                isCanceled
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-green-500/10 text-green-500"
              }`}
            >
              <span>{isCanceled ? "⚠ Đã hủy — còn hiệu lực" : "✓ Đã Subscribe"}</span>
              {isCanceled && currentSub?.currentPeriodEnd && (
                <span className="text-xs text-muted-foreground">
                  Hết hạn{" "}
                  {formatDistanceToNow(new Date(currentSub.currentPeriodEnd), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
            {!isCanceled && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="w-full py-2 rounded-lg border border-muted text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isPending ? "Đang hủy..." : "Hủy Subscription"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isPending}
            className="mt-auto w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-50"
            style={{ backgroundColor: badgeColor }}
          >
            {isPending ? "Đang subscribe..." : `Subscribe ${formatVND(tier.priceCents)}/tháng`}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SubscriptionTiersGrid — grid hiển thị tất cả tiers.
 */
export function SubscriptionTiersGrid({
  tiers,
  streamerId,
  currentSub,
}: {
  tiers: Tier[];
  currentSub: { tierId: string; tierName: string; status: string } | null;
  streamerId: string;
}) {
  if (tiers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Streamer này chưa có Subscription.
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => (
        <SubscriptionCard
          key={tier.id}
          tier={tier}
          streamerId={streamerId}
          currentSub={currentSub}
        />
      ))}
    </div>
  );
}
