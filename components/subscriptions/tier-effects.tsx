/**
 * TierEffects — style 4 tier subscription (Đồng/Bạc/Vàng/Kim Cương).
 *
 * Bug 2A: thêm "wow factor" cho mỗi tier để user có lý do chọn tier cao.
 *
 * - Tier 1 (Đồng): subtle gradient, bronze border, basic glow.
 * - Tier 2 (Bạc): shimmer animation, silver border, brighter glow.
 * - Tier 3 (Vàng): sparkle particles + animated rainbow border, golden glow.
 * - Tier 4 (Kim Cương): full premium — multi-sparkle + rainbow shimmer + prism glow.
 *
 * Pure CSS animations (no library).
 * `prefers-reduced-motion` được tôn trọng (CSS @media query ở globals.css).
 */

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type TierLevel = 1 | 2 | 3 | 4;

export type TierStyle = {
  /** Background gradient class cho card. */
  bg: string;
  /** Border color class. */
  border: string;
  /** Glow shadow class. */
  glow: string;
  /** Inline CSS variable cho pulse glow intensity. */
  glowVar: string;
  /** Có shimmer animation không. */
  shimmer: boolean;
  /** Có sparkle particles không. */
  sparkle: boolean;
  /** Số sparkle particles. */
  sparkleCount: number;
  /** Có animated rainbow border không. */
  rainbowBorder: boolean;
  /** Có pulsing glow không. */
  pulseGlow: boolean;
};

/**
 * Map level → style config.
 */
export function getTierStyle(level: number): TierStyle {
  const lvl = (level >= 1 && level <= 4 ? level : 1) as TierLevel;
  switch (lvl) {
    case 1: // Đồng (Bronze)
      return {
        bg: "bg-gradient-to-br from-amber-100/40 via-amber-50/30 to-orange-100/30 dark:from-amber-900/20 dark:via-amber-950/15 dark:to-orange-950/20",
        border: "border-amber-700/50 dark:border-amber-500/40",
        glow: "shadow-[0_0_15px_rgba(205,127,50,0.25)]",
        glowVar: "rgba(205, 127, 50, 0.35)",
        shimmer: false,
        sparkle: false,
        sparkleCount: 0,
        rainbowBorder: false,
        pulseGlow: false,
      };
    case 2: // Bạc (Silver)
      return {
        bg: "bg-gradient-to-br from-slate-200/50 via-slate-100/40 to-gray-200/40 dark:from-slate-800/30 dark:via-slate-900/20 dark:to-gray-800/30",
        border: "border-slate-500/60 dark:border-slate-400/50",
        glow: "shadow-[0_0_18px_rgba(192,192,192,0.4)]",
        glowVar: "rgba(192, 192, 192, 0.5)",
        shimmer: true,
        sparkle: false,
        sparkleCount: 0,
        rainbowBorder: false,
        pulseGlow: false,
      };
    case 3: // Vàng (Gold)
      return {
        bg: "bg-gradient-to-br from-yellow-200/50 via-amber-200/40 to-yellow-300/40 dark:from-yellow-900/25 dark:via-amber-900/20 dark:to-yellow-800/25",
        border: "border-yellow-600/70 dark:border-yellow-500/60",
        glow: "shadow-[0_0_22px_rgba(255,215,0,0.5)]",
        glowVar: "rgba(255, 215, 0, 0.55)",
        shimmer: true,
        sparkle: true,
        sparkleCount: 6,
        rainbowBorder: true,
        pulseGlow: false,
      };
    case 4: // Kim Cương (Diamond)
    default:
      return {
        bg: "bg-gradient-to-br from-cyan-300/40 via-fuchsia-300/30 to-pink-300/40 dark:from-cyan-900/30 dark:via-fuchsia-900/25 dark:to-pink-900/30",
        border: "border-cyan-400/80 dark:border-cyan-400/70",
        glow: "shadow-[0_0_28px_rgba(34,211,238,0.6)]",
        glowVar: "rgba(34, 211, 238, 0.65)",
        shimmer: true,
        sparkle: true,
        sparkleCount: 10,
        rainbowBorder: true,
        pulseGlow: true,
      };
  }
}

/**
 * TierEffects — render shimmer overlay + sparkle particles + rainbow border ring
 * nếu tier style yêu cầu.
 *
 * @param level - tier level (1-4)
 * @param badgeColor - màu badge chính (để dùng cho sparkle dots).
 */
export function TierEffects({
  level,
  badgeColor,
}: {
  level: number;
  badgeColor: string;
}) {
  const style = getTierStyle(level);

  // Sparkle color chọn theo tier (light yellow cho kim cương, gold cho vàng, etc).
  const sparkleColor =
    level === 4
      ? "bg-cyan-200"
      : level === 3
      ? "bg-yellow-200"
      : level === 2
      ? "bg-slate-100"
      : "bg-amber-100";

  return (
    <>
      {/* Shimmer overlay (level ≥ 2) */}
      {style.shimmer && (
        <span
          className="tier-shimmer-overlay absolute inset-0 rounded-[inherit] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Rainbow border ring (level ≥ 3) */}
      {style.rainbowBorder && (
        <span
          className="tier-rainbow-border absolute -inset-[2px] rounded-[inherit] pointer-events-none opacity-70 -z-10"
          aria-hidden="true"
        />
      )}

      {/* Sparkle particles (level ≥ 3) */}
      {style.sparkle && style.sparkleCount > 0 && (
        <SparkleParticles
          count={style.sparkleCount}
          color={sparkleColor}
        />
      )}

      {/* Pulse glow — dùng inline CSS variable */}
      {style.pulseGlow && (
        <span
          className="tier-pulse-glow absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ "--tier-glow": style.glowVar } as CSSProperties}
          aria-hidden="true"
        />
      )}
    </>
  );
}

/**
 * SparkleParticles — render N dots ở vị trí pseudo-random với delay khác nhau.
 *
 * Pure CSS animation (keyframes ở globals.css).
 */
function SparkleParticles({
  count,
  color,
}: {
  count: number;
  color: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        // Pseudo-random positions dựa trên i (stable across renders).
        const top = `${((i * 13) % 90) + 5}%`;
        const left = `${((i * 23 + 7) % 90) + 5}%`;
        const delay = `${((i * 0.3) % 2).toFixed(2)}s`;
        const size = i % 3 === 0 ? "h-1.5 w-1.5" : "h-1 w-1";
        return (
          <span
            key={i}
            className={cn(
              "absolute rounded-full opacity-0 animate-tier-sparkle pointer-events-none",
              size,
              color
            )}
            style={{
              top,
              left,
              animationDelay: delay,
            }}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/**
 * TierBadge — small label cho tier (vd: "Đồng", "Bạc", "Vàng", "Kim Cương").
 *
 * Có gradient + glow riêng cho mỗi tier.
 */
export function TierBadgeLabel(level: number): string {
  const lvl = (lvlValid(level) ? level : 1) as TierLevel;
  switch (lvl) {
    case 1:
      return "Đồng";
    case 2:
      return "Bạc";
    case 3:
      return "Vàng";
    case 4:
      return "Kim Cương";
  }
}

/**
 * TierIcon (emoji) cho mỗi tier — dùng cho toast, alert, donate tier label.
 */
export function TierIcon(level: number): string {
  const lvl = (lvlValid(level) ? level : 1) as TierLevel;
  switch (lvl) {
    case 1:
      return "🥉";
    case 2:
      return "🥈";
    case 3:
      return "⭐";
    case 4:
      return "💎";
  }
}

/**
 * Internal: check level có hợp lệ không (1-4).
 */
function lvlValid(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 4;
}