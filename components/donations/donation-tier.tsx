/**
 * DonationTier — phân loại donation tier theo amount + style cho toast/preset button.
 *
 * Bug 2B: mỗi mức donate có hiệu ứng đặc biệt:
 *   - Bronze (≥ 10k): bronze border, basic.
 *   - Silver (≥ 50k): silver border + shimmer overlay.
 *   - Gold (≥ 100k): gold border + sparkle particles.
 *   - Diamond (≥ 200k): rainbow border + multi-sparkle + pulse glow.
 *
 * Tiền donate ở VNĐ (zero-decimal currency), truyền nguyên số (không nhân 100).
 */

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type DonationTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

/** Threshold cho mỗi tier (VNĐ, zero-decimal). */
export const DONATION_TIER_THRESHOLDS = {
  SILVER: 50_000,
  GOLD: 100_000,
  DIAMOND: 200_000,
} as const;

/**
 * Phân loại donation tier dựa trên amount (VNĐ).
 *
 * @param amountVND - số tiền donate bằng VNĐ (integer).
 * @returns tier tương ứng.
 */
export function getDonationTier(amountVND: number): DonationTier {
  if (amountVND >= DONATION_TIER_THRESHOLDS.DIAMOND) return "DIAMOND";
  if (amountVND >= DONATION_TIER_THRESHOLDS.GOLD) return "GOLD";
  if (amountVND >= DONATION_TIER_THRESHOLDS.SILVER) return "SILVER";
  return "BRONZE";
}

export type DonationTierStyle = {
  /** Border color class. */
  border: string;
  /** Text color class (cho active tier button). */
  text: string;
  /** Background gradient class. */
  bg: string;
  /** Glow shadow class. */
  glow: string;
  /** Inline CSS variable cho pulse glow intensity. */
  glowVar: string;
  /** Tier icon (emoji). */
  icon: string;
  /** Tier label tiếng Việt. */
  label: string;
  /** Có shimmer overlay không. */
  shimmer: boolean;
  /** Có sparkle particles không. */
  sparkle: boolean;
  /** Số sparkle particles. */
  sparkleCount: number;
  /** Có rainbow border không. */
  rainbowBorder: boolean;
  /** Có pulse glow không. */
  pulseGlow: boolean;
};

/**
 * Lấy style config cho donation tier.
 */
export function getDonationTierStyle(tier: DonationTier): DonationTierStyle {
  switch (tier) {
    case "BRONZE":
      return {
        border: "border-amber-600/60 dark:border-amber-500/50",
        text: "text-amber-700 dark:text-amber-300",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        glow: "shadow-[0_0_12px_rgba(205,127,50,0.3)]",
        glowVar: "rgba(205, 127, 50, 0.4)",
        icon: "🥉",
        label: "Đồng",
        shimmer: false,
        sparkle: false,
        sparkleCount: 0,
        rainbowBorder: false,
        pulseGlow: false,
      };
    case "SILVER":
      return {
        border: "border-slate-400/70 dark:border-slate-400/60",
        text: "text-slate-700 dark:text-slate-200",
        bg: "bg-slate-50 dark:bg-slate-900/30",
        glow: "shadow-[0_0_15px_rgba(192,192,192,0.4)]",
        glowVar: "rgba(192, 192, 192, 0.5)",
        icon: "🥈",
        label: "Bạc",
        shimmer: true,
        sparkle: false,
        sparkleCount: 0,
        rainbowBorder: false,
        pulseGlow: false,
      };
    case "GOLD":
      return {
        border: "border-yellow-500/70 dark:border-yellow-500/60",
        text: "text-yellow-700 dark:text-yellow-300",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        glow: "shadow-[0_0_18px_rgba(255,215,0,0.5)]",
        glowVar: "rgba(255, 215, 0, 0.55)",
        icon: "⭐",
        label: "Vàng",
        shimmer: true,
        sparkle: true,
        sparkleCount: 6,
        rainbowBorder: true,
        pulseGlow: false,
      };
    case "DIAMOND":
      return {
        border: "border-cyan-400/80 dark:border-cyan-400/70",
        text: "text-cyan-700 dark:text-cyan-300",
        bg: "bg-gradient-to-br from-cyan-50 via-fuchsia-50 to-pink-50 dark:from-cyan-950/30 dark:via-fuchsia-950/30 dark:to-pink-950/30",
        glow: "shadow-[0_0_22px_rgba(34,211,238,0.6)]",
        glowVar: "rgba(34, 211, 238, 0.65)",
        icon: "💎",
        label: "Kim Cương",
        shimmer: true,
        sparkle: true,
        sparkleCount: 10,
        rainbowBorder: true,
        pulseGlow: true,
      };
  }
}

/**
 * TierSparkleDots — render N sparkle dots trong wrapper.
 *
 * Dùng cho donate preset button khi active.
 */
export function TierSparkleDots({
  tier,
  count,
  color,
}: {
  tier: DonationTier;
  count: number;
  color: string;
}) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const top = `${((i * 17) % 80) + 10}%`;
        const left = `${((i * 23 + 11) % 80) + 10}%`;
        const delay = `${((i * 0.4) % 2).toFixed(2)}s`;
        const size = i % 3 === 0 ? "h-1.5 w-1.5" : "h-1 w-1";
        return (
          <span
            key={`${tier}-sparkle-${i}`}
            className={cn(
              "absolute rounded-full opacity-0 animate-tier-sparkle pointer-events-none",
              size,
              color
            )}
            style={{ top, left, animationDelay: delay }}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/**
 * TierEffectOverlay — render shimmer + rainbow border + pulse cho một element.
 * Trả về JSX wrapper (absolute positioned) để overlay trên card/button.
 */
export function TierEffectOverlay({
  tier,
}: {
  tier: DonationTier;
}) {
  const style = getDonationTierStyle(tier);

  // Sparkle color theo tier.
  const sparkleColor =
    tier === "DIAMOND"
      ? "bg-cyan-200"
      : tier === "GOLD"
      ? "bg-yellow-200"
      : tier === "SILVER"
      ? "bg-slate-100"
      : "bg-amber-100";

  return (
    <>
      {style.shimmer && (
        <span
          className="tier-shimmer-overlay absolute inset-0 rounded-[inherit] pointer-events-none"
          aria-hidden="true"
        />
      )}
      {style.rainbowBorder && (
        <span
          className="tier-rainbow-border absolute -inset-[2px] rounded-[inherit] pointer-events-none opacity-70 -z-10"
          aria-hidden="true"
        />
      )}
      {style.sparkle && style.sparkleCount > 0 && (
        <TierSparkleDots
          tier={tier}
          count={style.sparkleCount}
          color={sparkleColor}
        />
      )}
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