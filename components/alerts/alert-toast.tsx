"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ALERT_ICONS, ALERT_TITLES, type AlertType } from "@/lib/alert-service";

export type AlertItem = {
  id: string;
  type: AlertType;
  username: string;
  displayName?: string;
  amountCents?: number;
  tierName?: string;
  message?: string;
  timestamp: Date;
  style?: "slide-up" | "pop" | "fade" | "bounce";
  durationMs?: number;
};

/**
 * AlertToast — single alert popup.
 *
 * Animations:
 *   - slide-up: slide in from bottom, hold, slide out.
 *   - pop: scale 0 → 1 with bounce, then fade out.
 *   - fade: fade in + out.
 *   - bounce: bounce in, then fade out.
 */
export function AlertToast({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const duration = alert.durationMs ?? 5000;
  const style = alert.style ?? "slide-up";

  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    // Enter → hold → exit.
    const enterTimer = setTimeout(() => setPhase("hold"), 400);
    const exitTimer = setTimeout(() => {
      setPhase("exit");
      setTimeout(onDone, 300);
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [duration, onDone]);

  const icon = ALERT_ICONS[alert.type];
  const title = ALERT_TITLES[alert.type];

  const isDonation = alert.type === "DONATION" && alert.amountCents;
  const isSub = alert.type === "SUBSCRIBE" && alert.tierName;

  return (
    <div
      className={`
        pointer-events-none flex items-start gap-3 rounded-xl border px-4 py-3
        bg-gradient-to-r from-purple-900/90 to-purple-800/80
        border-purple-500/40 shadow-2xl shadow-purple-900/50
        min-w-[280px] max-w-sm
        ${phase === "enter" ? getEnterClass(style) : ""}
        ${phase === "hold" ? getHoldClass(style) : ""}
        ${phase === "exit" ? getExitClass(style) : ""}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-purple-300 font-medium mb-0.5">{title}</p>
        <p className="text-white font-semibold text-sm truncate">
          {alert.displayName ?? alert.username}
        </p>

        {isDonation && (
          <p className="text-yellow-300 font-bold text-lg mt-0.5">
            {new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
              maximumFractionDigits: 0,
            }).format(alert.amountCents!)}
          </p>
        )}

        {isSub && (
          <p className="text-purple-200 text-xs mt-0.5">
            Subscribed {alert.tierName}
          </p>
        )}

        {alert.message && (
          <p className="text-white/80 text-xs mt-1 italic truncate">
            &ldquo;{alert.message}&rdquo;
          </p>
        )}
      </div>

      {/* Subtle glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Animation classes
// ──────────────────────────────────────────────────────────────────────────

function getEnterClass(style: string): string {
  switch (style) {
    case "slide-up":
      return "animate-[slideUpIn_400ms_ease-out_forwards]";
    case "pop":
      return "animate-[popIn_400ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]";
    case "fade":
      return "animate-[fadeIn_400ms_ease-out_forwards]";
    case "bounce":
      return "animate-[bounceIn_400ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]";
    default:
      return "animate-[slideUpIn_400ms_ease-out_forwards]";
  }
}

function getHoldClass(style: string): string {
  switch (style) {
    case "pop":
      return "scale-100 opacity-100";
    case "bounce":
      return "scale-100 opacity-100";
    default:
      return "translate-y-0 opacity-100";
  }
}

function getExitClass(style: string): string {
  switch (style) {
    case "slide-up":
      return "animate-[slideUpOut_300ms_ease-in_forwards]";
    case "pop":
      return "animate-[fadeOut_300ms_ease-in_forwards]";
    case "fade":
      return "animate-[fadeOut_300ms_ease-in_forwards]";
    case "bounce":
      return "animate-[fadeOut_300ms_ease-in_forwards]";
    default:
      return "animate-[slideUpOut_300ms_ease-in_forwards]";
  }
}
