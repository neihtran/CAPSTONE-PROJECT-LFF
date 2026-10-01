/**
 * OpenAI Moderation Service — dùng OpenAI Moderation API để kiểm tra
 * chat messages có vi phạm không (hate, violence, harassment, ...).
 *
 * Fail-open: nếu API lỗi → coi như OK (không block user), tránh
 * moderator sai → user bị reject oan.
 *
 * Lưu ý: chỉ dùng cho chat MODERATION (nội dung toxic), KHÁC với
 * Moderation Actions service (timeout/ban) ở file
 * moderation-actions-service.ts.
 */

export type ModerationResult = {
  flagged: boolean;
  categories: string[];
};

/**
 * Moderation API call result shape (chỉ lấy phần mình cần).
 */
type OpenAIModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
  }>;
};

let cachedClient: unknown = null;

async function getClient(): Promise<typeof cachedClient> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  if (cachedClient) return cachedClient;

  try {
    const mod = await import("openai");
    const OpenAI = mod.default;
    cachedClient = new OpenAI({ apiKey });
    return cachedClient;
  } catch (err) {
    console.warn(
      "[moderateMessage] Failed to load openai SDK:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Check 1 message có vi phạm chính sách OpenAI không.
 *
 * @returns { flagged, categories } - categories là tên các vi phạm (vd: ["hate", "harassment"]).
 * Fail-open: lỗi → flagged=false, categories=[].
 */
export const moderateMessage = async (
  text: string
): Promise<ModerationResult> => {
  const trimmed = text?.trim() ?? "";

  // Input validation: rỗng → không gọi API, fail-open.
  if (!trimmed) {
    return { flagged: false, categories: [] };
  }

  const client = await getClient();
  if (!client) {
    // Không có API key hoặc SDK → fail-open.
    return { flagged: false, categories: [] };
  }

  try {
    const result = await (
      client as {
        moderations: {
          create: (args: {
            model: string;
            input: string;
          }) => Promise<OpenAIModerationResponse>;
        };
      }
    ).moderations.create({
      model: "omni-moderation-latest",
      input: trimmed,
    });

    if (!result?.results?.[0]) {
      return { flagged: false, categories: [] };
    }

    const first = result.results[0];
    const flagged = first.flagged ?? false;

    // Convert categories object → array of true values.
    const categories = first.categories
      ? Object.entries(first.categories)
          .filter(([, isTrue]) => isTrue)
          .map(([name]) => name)
      : [];

    return { flagged, categories };
  } catch (err) {
    console.warn(
      "[moderateMessage] API call failed:",
      err instanceof Error ? err.message : err
    );
    return { flagged: false, categories: [] };
  }
};
