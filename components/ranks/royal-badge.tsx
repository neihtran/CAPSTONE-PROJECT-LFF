"use client";

import React from "react";
import { RankTier } from "@/lib/rank-service";

/**
 * RoyalBadge — hiển thị tier icon + label cạnh username trong chat.
 *
 * Variants:
 *   - compact: chỉ icon (1 emoji).
 *   - default: icon + label.
 *   - full: icon + label + wealthValue + progress bar.
 */
export function RoyalBadge({
  tier,
  variant = "default",
  wealthValue,
  progressPct,
  className = "",
  showLabel = true,
}: {
  tier: RankTier;
  variant?: "compact" | "default" | "full";
  wealthValue?: number;
  progressPct?: number;
  className?: string;
  showLabel?: boolean;
}) {
  if (tier.id === "PEASANT") {
    // PEASANT: không hiển thị badge để giảm clutter.
    return null;
  }

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={`${tier.label} • ${tier.minWealth.toLocaleString()}+ wealth`}
        aria-label={`${tier.label} tier`}
      >
        <span style={{ filter: "drop-shadow(0 0 4px " + tier.color + ")" }}>
          {tier.icon}
        </span>
      </span>
    );
  }

  if (variant === "full" && wealthValue !== undefined && progressPct !== undefined) {
    return (
      <div
        className={`inline-flex flex-col gap-1 px-2 py-1 rounded-md border ${tier.bgClass} ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ filter: "drop-shadow(0 0 4px " + tier.color + ")" }}>
            {tier.icon}
          </span>
          {showLabel && (
            <span className="text-xs font-semibold" style={{ color: tier.color }}>
              {tier.label}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {wealthValue.toLocaleString()} WP
          </span>
        </div>
        {progressPct < 100 && (
          <div className="h-1 bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: tier.color,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // default: icon + label.
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tier.bgClass} ${className}`}
      title={`${tier.label} • ${tier.minWealth.toLocaleString()}+ wealth`}
    >
      <span>{tier.icon}</span>
      {showLabel && (
        <span style={{ color: tier.color }}>{tier.label}</span>
      )}
    </span>
  );
}
