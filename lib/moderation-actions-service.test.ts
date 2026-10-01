import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAI — service sẽ dùng mockCreate thay vì gọi API thật.
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class {
      constructor(_config: unknown) {}
      moderations = { create: mockCreate };
    },
  };
});

// Đặt key giả để service không fail-open.
process.env.OPENAI_API_KEY = "sk-test-mock-key";

import { moderateMessage } from "@/lib/ai-moderation-service";

describe("moderateMessage", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe("input validation", () => {
    it("should return not flagged for empty string", async () => {
      const result = await moderateMessage("");
      expect(result).toEqual({ flagged: false, categories: [] });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return not flagged for whitespace only", async () => {
      const result = await moderateMessage("   \n\t  ");
      expect(result).toEqual({ flagged: false, categories: [] });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should trim input before calling OpenAI", async () => {
      mockCreate.mockResolvedValue({
        results: [{ flagged: false, categories: {} }],
      });

      await moderateMessage("  hello  ");

      expect(mockCreate).toHaveBeenCalledWith({
        model: "omni-moderation-latest",
        input: "hello",
      });
    });
  });

  describe("API behavior (with mock key)", () => {
    it("should call OpenAI when message is non-empty", async () => {
      mockCreate.mockResolvedValue({
        results: [{ flagged: false, categories: {} }],
      });

      await moderateMessage("safe message");

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should detect flagged content with categories", async () => {
      mockCreate.mockResolvedValue({
        results: [
          {
            flagged: true,
            categories: {
              hate: true,
              violence: false,
              harassment: true,
            },
          },
        ],
      });

      const result = await moderateMessage("hateful content");

      expect(result.flagged).toBe(true);
      expect(result.categories).toEqual(
        expect.arrayContaining(["hate", "harassment"])
      );
      expect(result.categories).not.toContain("violence");
    });

    it("should return empty categories when not flagged", async () => {
      mockCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {
              hate: false,
              violence: false,
            },
          },
        ],
      });

      const result = await moderateMessage("perfectly safe");

      expect(result.flagged).toBe(false);
      expect(result.categories).toEqual([]);
    });
  });

  describe("error handling (fail-open)", () => {
    it("should fail-open when API throws", async () => {
      mockCreate.mockRejectedValue(new Error("Network error"));

      const result = await moderateMessage("test");

      expect(result).toEqual({ flagged: false, categories: [] });
    });

    it("should fail-open when API returns empty results array", async () => {
      mockCreate.mockResolvedValue({ results: [] });

      const result = await moderateMessage("test");

      expect(result).toEqual({ flagged: false, categories: [] });
    });

    it("should fail-open when results object is undefined", async () => {
      mockCreate.mockResolvedValue({});

      const result = await moderateMessage("test");

      expect(result).toEqual({ flagged: false, categories: [] });
    });
  });

  describe("model selection", () => {
    it("should use omni-moderation-latest model", async () => {
      mockCreate.mockResolvedValue({
        results: [{ flagged: false, categories: {} }],
      });

      await moderateMessage("test");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "omni-moderation-latest",
        })
      );
    });
  });
});
