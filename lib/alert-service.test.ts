import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    streamAlert: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  ALERT_STYLES,
  ALERT_ICONS,
  ALERT_TITLES,
} from "@/lib/alert-service";

const d = db as Record<string, ReturnType<typeof vi.fn>>;

describe("AlertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ALERT_STYLES", () => {
    it("should have 4 animation styles", () => {
      expect(ALERT_STYLES).toHaveLength(4);
      expect(ALERT_STYLES.map((s) => s.value)).toEqual([
        "slide-up",
        "pop",
        "fade",
        "bounce",
      ]);
    });
  });

  describe("ALERT_ICONS", () => {
    it("should have icons for all alert types", () => {
      expect(ALERT_ICONS.FOLLOW).toBe("👋");
      expect(ALERT_ICONS.SUBSCRIBE).toBe("⭐");
      expect(ALERT_ICONS.DONATION).toBe("💸");
      expect(ALERT_ICONS.RAID).toBe("🚀");
      expect(ALERT_ICONS.CLIP).toBe("🎬");
    });
  });

  describe("ALERT_TITLES", () => {
    it("should have titles for all alert types", () => {
      expect(ALERT_TITLES.FOLLOW).toBe("New Follower!");
      expect(ALERT_TITLES.SUBSCRIBE).toBe("New Subscriber!");
      expect(ALERT_TITLES.DONATION).toBe("Donation!");
      expect(ALERT_TITLES.RAID).toBe("Incoming Raid!");
      expect(ALERT_TITLES.CLIP).toBe("New Clip!");
    });
  });
});
