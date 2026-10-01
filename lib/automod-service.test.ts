import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  return {
    db: {
      bannedWord: {
        findMany: vi.fn(),
      },
    },
  };
});

import { db } from "@/lib/db";
import { checkBannedWords } from "@/lib/automod-service";

const mockFindMany = db.bannedWord.findMany as ReturnType<typeof vi.fn>;

describe("checkBannedWords", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  describe("basic behavior", () => {
    it("should allow empty message without DB query", async () => {
      const result = await checkBannedWords("stream-id", "");
      expect(result).toEqual({ allowed: true });
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("should allow when stream has no banned words", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await checkBannedWords("stream-id", "hello");
      expect(result).toEqual({ allowed: true });
    });
  });

  describe("plain text patterns", () => {
    it("should reject message containing plain text banned word", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "badword", action: "REJECT" },
      ]);

      const result = await checkBannedWords("stream-id", "this is badword");
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("REJECT");
      expect(result.matchedPattern).toBe("badword");
    });

    it("should match case-insensitively", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "badword", action: "REJECT" },
      ]);

      const result = await checkBannedWords("stream-id", "BADWORD here");
      expect(result.allowed).toBe(false);
    });
  });

  describe("FILTER action", () => {
    it("should mask message when action is FILTER", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "spam", action: "FILTER" },
      ]);

      const result = await checkBannedWords("stream-id", "this is spam");
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("FILTER");
      expect(result.maskedMessage).toBe("this is ****");
    });
  });

  describe("regex patterns", () => {
    it("should match regex with metacharacters", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "\\bbad\\w*", action: "REJECT" },
      ]);

      const result = await checkBannedWords(
        "stream-id",
        "this is badword here"
      );
      expect(result.allowed).toBe(false);
    });

    it("should fallback to plain text when regex is invalid", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "[unclosed", action: "REJECT" },
      ]);

      const result = await checkBannedWords(
        "stream-id",
        "this contains [unclosed"
      );
      // "[unclosed" → fallback includes("[unclosed") — pattern lower = "[unclosed"
      // → includes("unclosed") ở "this contains [unclosed" → tìm "unclosed" trong lower...
      // Pattern lower = "[unclosed" → match trong "this contains [unclosed"
      // → true. Nhưng vì fallback tới plain "unclosed" sau khi fail regex:
      // includes("unclosed") trong "this contains [unclosed" → TRUE (lower case chứa "unclosed").
      // Vậy matched = true → reject.
      expect(result.allowed).toBe(false);
    });

    it("should mask regex matches", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "bad\\w+", action: "FILTER" },
      ]);

      const result = await checkBannedWords(
        "stream-id",
        "this is badword here"
      );
      expect(result.allowed).toBe(true);
      expect(result.maskedMessage).toMatch(/\*+/);
    });
  });

  describe("multiple patterns", () => {
    it("should stop at first match", async () => {
      mockFindMany.mockResolvedValue([
        { pattern: "first", action: "FILTER" },
        { pattern: "second", action: "REJECT" },
      ]);

      const result = await checkBannedWords(
        "stream-id",
        "contains first and second"
      );
      // First pattern matches → FILTER → mask + allowed=true.
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("FILTER");
    });
  });

  describe("fail-open", () => {
    it("should allow when DB throws error", async () => {
      mockFindMany.mockRejectedValue(new Error("DB down"));

      const result = await checkBannedWords("stream-id", "any message");
      expect(result).toEqual({ allowed: true });
    });
  });
});
