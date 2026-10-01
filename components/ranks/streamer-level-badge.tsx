"use client";

import React from "react";
import { StreamerLevelTier } from "@/lib/streamer-level-service";

/**
 * StreamerLevelBadge — hiển thị level của streamer.
 *
 * Variants:
 *   - compact: chỉ icon.
 *   - default: icon + level label.
 *   - full: icon + label + XP + progress bar.
 */
export function StreamerLevelBadge({
  level,
  variant = "default",
  xp,
  progressPct,
  className = "",
}: {
  level: StreamerLevelTier;
  variant?: "compact" | "default" | "full";
  xp?: number;
  progressPct?: number;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={`${level.label} • ${level.minXp.toLocaleString()}+ XP`}
        aria-label={`Streamer level: ${level.label}`}
      >
        <span style={{ filter: "drop-shadow(0 0 4px " + level.color + ")" }}>
          {level.icon}
        </span>
      </span>
    );
  }

  if (variant === "full" && xp !== undefined && progressPct !== undefined) {
    return (
      <div className={`inline-flex flex-col gap-1.5 p-3 rounded-lg border border-l-4 bg-card ${className}`}
        style={{ borderLeftColor: level.color }}>
        <div className="flex items-center gap-2">
          <span
            className="text-xl"
            style={{ filter: "drop-shadow(0 0 6px " + level.color + ")" }}
          >
            {level.icon}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: level.color }}>
              {level.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {xp.toLocaleString()} XP
            </span>
          </div>
        </div>
        {progressPct < 100 && (
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: level.color,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${className}`}
      title={`${level.label} • ${level.minXp.toLocaleString()}+ XP`}
      style={{
        color: level.color,
        borderColor: level.color + "40",
        backgroundColor: level.color + "10",
      }}
    >
      <span>{level.icon}</span>
      <span>{level.label}</span>
    </span>
  );
}
