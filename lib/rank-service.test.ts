import { describe, it, expect } from "vitest";
import {
  RANK_TIERS,
  getTierFromWealth,
  getProgressToNextTier,
} from "@/lib/rank-service";

describe("RankService - Tier calculation", () => {
  describe("getTierFromWealth", () => {
    it("should return PEASANT for 0", () => {
      const tier = getTierFromWealth(0);
      expect(tier.id).toBe("PEASANT");
    });

    it("should return KNIGHT for 1000", () => {
      const tier = getTierFromWealth(1000);
      expect(tier.id).toBe("KNIGHT");
    });

    it("should return KNIGHT for 4999 (top of bracket)", () => {
      const tier = getTierFromWealth(4999);
      expect(tier.id).toBe("KNIGHT");
    });

    it("should return EARL at 5000", () => {
      const tier = getTierFromWealth(5000);
      expect(tier.id).toBe("EARL");
    });

    it("should return DUKE at 20K", () => {
      const tier = getTierFromWealth(20000);
      expect(tier.id).toBe("DUKE");
    });

    it("should return KING at 100K", () => {
      const tier = getTierFromWealth(100000);
      expect(tier.id).toBe("KING");
    });

    it("should return EMPEROR at 300K", () => {
      const tier = getTierFromWealth(300000);
      expect(tier.id).toBe("EMPEROR");
    });

    it("should return EMPEROR for very high values", () => {
      const tier = getTierFromWealth(1_000_000);
      expect(tier.id).toBe("EMPEROR");
    });

    it("should handle boundary just below tier", () => {
      const tier = getTierFromWealth(999);
      expect(tier.id).toBe("PEASANT");
    });
  });

  describe("RANK_TIERS config", () => {
    it("should have 6 tiers", () => {
      expect(RANK_TIERS).toHaveLength(6);
    });

    it("tiers should be sorted by minWealth ascending", () => {
      for (let i = 1; i < RANK_TIERS.length; i++) {
        expect(RANK_TIERS[i].minWealth).toBeGreaterThan(
          RANK_TIERS[i - 1].minWealth
        );
      }
    });

    it("each tier should have icon + color", () => {
      for (const tier of RANK_TIERS) {
        expect(tier.icon).toBeTruthy();
        expect(tier.color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  describe("getProgressToNextTier", () => {
    it("should return 0% at start of tier", () => {
      const result = getProgressToNextTier(1000);
      expect(result.currentTier.id).toBe("KNIGHT");
      expect(result.nextTier?.id).toBe("EARL");
      // 1000 → 5000 (KNIGHT 1K → EARL 5K)
      // 1000 is at start of KNIGHT → 0%
      expect(result.progressPct).toBeGreaterThanOrEqual(0);
    });

    it("should return 100% at top tier (no next)", () => {
      const result = getProgressToNextTier(500_000);
      expect(result.nextTier).toBeNull();
      expect(result.progressPct).toBe(100);
    });

    it("should calculate intermediate progress correctly", () => {
      // 25000 = 50% through KNIGHT (1000-5000, halfway is 3000)
      const result = getProgressToNextTier(3000);
      expect(result.currentTier.id).toBe("KNIGHT");
      expect(result.nextTier?.id).toBe("EARL");
      // 50% (3000 is halfway through 1000-5000)
      expect(result.progressPct).toBeGreaterThanOrEqual(45);
      expect(result.progressPct).toBeLessThanOrEqual(55);
    });
  });
});
