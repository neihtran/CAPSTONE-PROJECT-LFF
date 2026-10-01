import { db } from "@/lib/db";
import { BannedWordAction } from "@/lib/moderation-actions-service";

/**
 * AutoMod — check 1 message có vi phạm banned words của stream không.
 *
 * Logic:
 *   1. Load tất cả BannedWord của stream (cache có thể thêm sau).
 *   2. Với mỗi banned word:
 *      - Plain text: simple case-insensitive `includes`.
 *      - Regex: thử compile + match, fail → fallback plain text.
 *   3. Trả về action (REJECT/FILTER) + masked message nếu FILTER.
 *
 * Fail-open: nếu lỗi DB → trả về allowed=true (không block user oan).
 *
 * @returns {
 *   allowed: boolean (true = cho phép gửi),
 *   action?: "REJECT" | "FILTER",
 *   maskedMessage?: string,
 *   matchedPattern?: string,
 * }
 */
export type AutoModResult = {
  allowed: boolean;
  action?: "REJECT" | "FILTER";
  maskedMessage?: string;
  matchedPattern?: string;
};

export const checkBannedWords = async (
  streamId: string,
  message: string
): Promise<AutoModResult> => {
  const trimmed = message?.trim() ?? "";
  if (!trimmed) return { allowed: true };

  let bannedWords;
  try {
    bannedWords = await db.bannedWord.findMany({
      where: { streamId },
      select: { pattern: true, action: true },
    });
  } catch (err) {
    console.warn(
      "[checkBannedWords] DB error, fail-open:",
      err instanceof Error ? err.message : err
    );
    return { allowed: true };
  }

  if (bannedWords.length === 0) return { allowed: true };

  const lower = trimmed.toLowerCase();

  for (const bw of bannedWords) {
    const pattern = bw.pattern;

    // Detect regex: chứa metacharacter hoặc escape sequence.
    const looksLikeRegex =
      pattern.includes("\\") ||
      pattern.includes("[") ||
      pattern.includes("(") ||
      pattern.includes("{") ||
      pattern.includes(".") ||
      pattern.includes("*") ||
      pattern.includes("+") ||
      pattern.includes("?") ||
      pattern.includes("^") ||
      pattern.includes("$");

    let matched = false;

    if (looksLikeRegex) {
      try {
        const regex = new RegExp(pattern, "i");
        matched = regex.test(trimmed);
      } catch {
        // Invalid regex → fallback to plain text match.
        matched = lower.includes(pattern.toLowerCase());
      }
    } else {
      matched = lower.includes(pattern.toLowerCase());
    }

    if (matched) {
      if (bw.action === BannedWordAction.REJECT) {
        return {
          allowed: false,
          action: "REJECT",
          matchedPattern: pattern,
        };
      }

      // FILTER — mask tất cả substring khớp bằng *.
      let masked = trimmed;
      try {
        if (looksLikeRegex) {
          const regex = new RegExp(pattern, "gi");
          masked = masked.replace(regex, (m) => "*".repeat(m.length));
        } else {
          const idx = lower.indexOf(pattern.toLowerCase());
          if (idx >= 0) {
            masked =
              masked.substring(0, idx) +
              "*".repeat(pattern.length) +
              masked.substring(idx + pattern.length);
          }
        }
      } catch {
        // Replace failed → return original (user sees their own msg).
      }

      return {
        allowed: true,
        action: "FILTER",
        maskedMessage: masked,
        matchedPattern: pattern,
      };
    }
  }

  return { allowed: true };
};
