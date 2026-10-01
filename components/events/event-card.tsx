"use client";

import React from "react";
import Link from "next/link";

import {
  getProgressPct,
  getEventTypeMeta,
  formatEventValue,
  type EventType,
} from "@/lib/event-service";

export type EventCardData = {
  id: string;
  type: string;
  title: string;
  body: string;
  currentValue: number;
  targetValue: number;
  rewardValueCents: number;
  rewardDescription: string | null;
  endsAt: Date | null;
  status: string;
  streamer?: {
    id: string;
    username: string;
    imageUrl: string;
  } | null;
};

/**
 * EventCard — display 1 event với progress bar và metadata.
 *
 * Variants:
 *   - default: full card với streamer info, progress, reward.
 *   - compact: chỉ title + progress bar (cho sidebar).
 */
export function EventCard({
  event,
  variant = "default",
}: {
  event: EventCardData;
  variant?: "default" | "compact";
}) {
  const type = event.type as EventType;
  const meta = getEventTypeMeta(type);
  const progressPct = getProgressPct(event.currentValue, event.targetValue);
  const isCompleted = event.status === "COMPLETED";

  if (variant === "compact") {
    return (
      <Link
        href="/events"
        className="block p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span>{meta.icon}</span>
          <span className="font-semibold text-sm truncate flex-1">{event.title}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted ? "bg-green-500" : "bg-primary"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatEventValue(event.currentValue, type)} / {formatEventValue(event.targetValue, type)}
        </p>
      </Link>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg ${
        isCompleted ? "border-green-500/40" : "border-border"
      }`}
    >
      {/* Header */}
      <div className={`p-5 ${isCompleted ? "bg-green-500/5" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl">{meta.icon}</span>
            <div className="min-w-0">
              <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                {meta.label}
              </span>
              <h3 className="font-bold text-lg leading-tight truncate">
                {event.title}
              </h3>
            </div>
          </div>
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-semibold">
              ✓ Completed
            </span>
          )}
        </div>

        {event.streamer && (
          <Link
            href={`/u/${event.streamer.username}`}
            className="flex items-center gap-2 mt-3 text-sm text-muted-foreground hover:text-foreground"
          >
            {event.streamer.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.streamer.imageUrl}
                alt={event.streamer.username}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span>by {event.streamer.username}</span>
          </Link>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pb-5">
        <p className="text-sm text-muted-foreground mb-4">{event.body}</p>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {formatEventValue(event.currentValue, type)}
            </span>
            <span className="text-muted-foreground">
              / {formatEventValue(event.targetValue, type)}
            </span>
            <span className={`ml-auto font-bold ${isCompleted ? "text-green-400" : "text-primary"}`}>
              {progressPct}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCompleted
                  ? "bg-gradient-to-r from-green-500 to-emerald-400"
                  : "bg-gradient-to-r from-primary to-purple-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Reward */}
        {(event.rewardValueCents > 0 || event.rewardDescription) && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs font-semibold text-amber-400 uppercase">
              🎁 Reward
            </p>
            {event.rewardValueCents > 0 && (
              <p className="text-sm font-bold text-amber-300">
                {new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                  maximumFractionDigits: 0,
                }).format(event.rewardValueCents)}
              </p>
            )}
            {event.rewardDescription && (
              <p className="text-sm text-amber-200/80">
                {event.rewardDescription}
              </p>
            )}
          </div>
        )}

        {/* End date */}
        {event.endsAt && (
          <p className="text-xs text-muted-foreground mt-3">
            ⏰ Ends {new Date(event.endsAt).toLocaleDateString("vi-VN")}
          </p>
        )}
      </div>
    </div>
  );
}
