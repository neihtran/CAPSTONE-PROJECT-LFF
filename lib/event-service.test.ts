import { describe, it, expect } from "vitest";
import {
  validateEventInput,
  getProgressPct,
  getEventTypeMeta,
  formatEventValue,
  EVENT_TYPES,
  EVENT_STATUS,
} from "@/lib/event-service";

describe("EventService - Validation", () => {
  describe("validateEventInput", () => {
    const valid = {
      streamerId: "user_1",
      type: "DONATION_GOAL" as const,
      title: "Test Event",
      body: "Test body",
      targetValue: 10000,
    };

    it("should accept valid input", () => {
      expect(validateEventInput(valid)).toBeNull();
    });

    it("should reject empty title", () => {
      expect(validateEventInput({ ...valid, title: "" })).toBeTruthy();
    });

    it("should reject title > 200 chars", () => {
      expect(
        validateEventInput({ ...valid, title: "a".repeat(201) })
      ).toMatch(/200/);
    });

    it("should reject empty body", () => {
      expect(validateEventInput({ ...valid, body: "" })).toBeTruthy();
    });

    it("should reject target ≤ 0", () => {
      expect(validateEventInput({ ...valid, targetValue: 0 })).toBeTruthy();
      expect(validateEventInput({ ...valid, targetValue: -1 })).toBeTruthy();
    });

    it("should reject endsAt before startsAt", () => {
      const result = validateEventInput({
        ...valid,
        startsAt: new Date("2026-12-31"),
        endsAt: new Date("2026-01-01"),
      });
      expect(result).toMatch(/after/);
    });

    it("should accept endsAt after startsAt", () => {
      expect(
        validateEventInput({
          ...valid,
          startsAt: new Date("2026-01-01"),
          endsAt: new Date("2026-12-31"),
        })
      ).toBeNull();
    });
  });

  describe("EVENT_TYPES enum", () => {
    it("should have 8 event types", () => {
      expect(EVENT_TYPES.length).toBe(8);
    });

    it("should include DONATION_GOAL", () => {
      expect(EVENT_TYPES).toContain("DONATION_GOAL");
    });

    it("should include SUBSCRIPTION_MILESTONE", () => {
      expect(EVENT_TYPES).toContain("SUBSCRIPTION_MILESTONE");
    });
  });

  describe("EVENT_STATUS enum", () => {
    it("should have 5 status values", () => {
      expect(EVENT_STATUS.length).toBe(5);
    });

    it("should include ACTIVE and COMPLETED", () => {
      expect(EVENT_STATUS).toContain("ACTIVE");
      expect(EVENT_STATUS).toContain("COMPLETED");
    });
  });
});

describe("EventService - Progress", () => {
  describe("getProgressPct", () => {
    it("should return 0% at start", () => {
      expect(getProgressPct(0, 1000)).toBe(0);
    });

    it("should return 50% at halfway", () => {
      expect(getProgressPct(500, 1000)).toBe(50);
    });

    it("should return 100% at completion", () => {
      expect(getProgressPct(1000, 1000)).toBe(100);
    });

    it("should cap at 100% for overfill", () => {
      expect(getProgressPct(1500, 1000)).toBe(100);
    });

    it("should handle target 0 gracefully", () => {
      expect(getProgressPct(100, 0)).toBe(0);
    });

    it("should round percent correctly", () => {
      expect(getProgressPct(333, 1000)).toBe(33);
      expect(getProgressPct(666, 1000)).toBe(67);
    });
  });
});

describe("EventService - Meta", () => {
  describe("getEventTypeMeta", () => {
    it("should return meta for DONATION_GOAL", () => {
      const meta = getEventTypeMeta("DONATION_GOAL");
      expect(meta.icon).toBe("💰");
      expect(meta.label).toBe("Donation Goal");
    });

    it("should return meta for SUBSCRIPTION_MILESTONE", () => {
      const meta = getEventTypeMeta("SUBSCRIPTION_MILESTONE");
      expect(meta.icon).toBe("⭐");
    });

    it("should return meta for VIEWER_MILESTONE", () => {
      const meta = getEventTypeMeta("VIEWER_MILESTONE");
      expect(meta.icon).toBe("👁️");
    });

    it("should fallback to CUSTOM for unknown type", () => {
      // @ts-expect-error - testing fallback
      const meta = getEventTypeMeta("UNKNOWN_TYPE");
      expect(meta.icon).toBe("🎯");
    });
  });

  describe("formatEventValue", () => {
    it("should format VND for DONATION_GOAL", () => {
      expect(formatEventValue(100000, "DONATION_GOAL")).toMatch(/100\.000/);
      expect(formatEventValue(5000, "DONATION_GOAL")).toMatch(/5\.000/);
    });

    it("should format as count for SUBSCRIPTION_MILESTONE", () => {
      expect(formatEventValue(50, "SUBSCRIPTION_MILESTONE")).toBe("50");
    });

    it("should format as count with commas for large values", () => {
      expect(formatEventValue(1234, "FOLLOW_GOAL")).toBe("1,234");
    });

    it("should format VND for CUSTOM", () => {
      expect(formatEventValue(500000, "CUSTOM")).toMatch(/500\.000/);
    });
  });
});
