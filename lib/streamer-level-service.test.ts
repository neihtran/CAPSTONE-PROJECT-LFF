import { describe, it, expect } from "vitest";
import {
  STREAMER_LEVELS,
  getLevelFromXp,
  getProgressToNextLevel,
} from "@/lib/streamer-level-service";

describe("StreamerLevelService - Level calculation", () => {
  describe("getLevelFromXp", () => {
    it("should return NEW for 0 XP", () => {
      const level = getLevelFromXp(0);
      expect(level.id).toBe("NEW");
    });

    it("should return RISING at 1K XP", () => {
      const level = getLevelFromXp(1000);
      expect(level.id).toBe("RISING");
    });

    it("should return POPULAR at 5K XP", () => {
      const level = getLevelFromXp(5000);
      expect(level.id).toBe("POPULAR");
    });

    it("should return FAMOUS at 25K XP", () => {
      const level = getLevelFromXp(25000);
      expect(level.id).toBe("FAMOUS");
    });

    it("should return STAR at 100K XP", () => {
      const level = getLevelFromXp(100000);
      expect(level.id).toBe("STAR");
    });

    it("should return ICON at 500K XP", () => {
      const level = getLevelFromXp(500000);
      expect(level.id).toBe("ICON");
    });

    it("should return ICON for very high XP", () => {
      const level = getLevelFromXp(2_000_000);
      expect(level.id).toBe("ICON");
    });

    it("should handle boundaries", () => {
      expect(getLevelFromXp(999).id).toBe("NEW");
      expect(getLevelFromXp(4999).id).toBe("RISING");
    });
  });

  describe("STREAMER_LEVELS config", () => {
    it("should have 6 tiers", () => {
      expect(STREAMER_LEVELS).toHaveLength(6);
    });

    it("tiers should be sorted by minXp ascending", () => {
      for (let i = 1; i < STREAMER_LEVELS.length; i++) {
        expect(STREAMER_LEVELS[i].minXp).toBeGreaterThanOrEqual(
          STREAMER_LEVELS[i - 1].minXp
        );
      }
    });

    it("each tier should have icon + color", () => {
      for (const tier of STREAMER_LEVELS) {
        expect(tier.icon).toBeTruthy();
        expect(tier.color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  describe("getProgressToNextLevel", () => {
    it("should return 100% at top level (no next)", () => {
      const result = getProgressToNextLevel(1_000_000);
      expect(result.next).toBeNull();
      expect(result.progressPct).toBe(100);
      expect(result.xpNeeded).toBe(0);
    });

    it("should track progress correctly mid-tier", () => {
      // NEW → RISING: 0-1000, RISING → POPULAR: 1000-5000
      // At 6000: we're in POPULAR tier (5000-25000)
      // Progress to FAMOUS (25K): (6000 - 5000) / (25000 - 5000) = 5%
      const result = getProgressToNextLevel(6000);
      expect(result.current.id).toBe("POPULAR");
      expect(result.next?.id).toBe("FAMOUS");
      expect(result.progressPct).toBeGreaterThanOrEqual(0);
      expect(result.progressPct).toBeLessThanOrEqual(10);
    });

    it("should calculate xpNeeded correctly", () => {
      // At 200 XP, need 1000 - 200 = 800 to reach RISING
      const result = getProgressToNextLevel(200);
      expect(result.current.id).toBe("NEW");
      expect(result.next?.id).toBe("RISING");
      expect(result.xpNeeded).toBe(800);
    });
  });
});
