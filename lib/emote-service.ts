/**
 * EmoteService — quản lý emotes trong chat.
 *
 * 2 loại emotes:
 *   - GLOBAL: platform-wide, admin tạo. Dùng ở mọi stream.
 *   - CHANNEL: streamer tự tạo cho channel riêng. Chỉ hiển thị trong stream đó.
 *
 * Shortcode format:
 *   - 1-50 ký tự, lowercase, không có khoảng trắng.
 *   - VD: "KEKW", "pog", "peepohappy", "ha".
 *
 * Upload: dùng UploadThing. Giới hạn:
 *   - Định dạng: PNG, GIF, WebP.
 *   - Kích thước: max 64KB.
 *   - Kích thước hiển thị: 64x64px.
 */

import { db } from "@/lib/db";

export type Emote = {
  id: string;
  code: string;
  scope: string;
  imageUrl: string;
  width: number;
  height: number;
  channelId: string | null;
};

// ──────────────────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lấy tất cả emotes visible cho 1 stream:
 *   - Tất cả GLOBAL emotes.
 *   - Emotes của channel đó (CHANNEL scope).
 *
 * Cache ở client với revalidate theo channelId.
 */
export const getStreamEmotes = async (streamerId: string) => {
  return db.emote.findMany({
    where: {
      OR: [
        { scope: "GLOBAL", status: "ACTIVE" },
        { channelId: streamerId, scope: "CHANNEL", status: "ACTIVE" },
      ],
    },
    orderBy: { code: "asc" },
  });
};

/**
 * Lấy global emotes (admin use).
 */
export const getGlobalEmotes = async () => {
  return db.emote.findMany({
    where: { scope: "GLOBAL", status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Tạo 1 emote mới (global hoặc channel).
 *
 * @param scope  "GLOBAL" | "CHANNEL"
 * @param channelId  required nếu scope = "CHANNEL"
 */
export const createEmote = async (params: {
  code: string;
  imageUrl: string;
  scope: "GLOBAL" | "CHANNEL";
  channelId?: string;
  fileSizeBytes?: number;
  uploaderId?: string;
}) => {
  const code = params.code.toLowerCase().trim();

  if (code.length < 1 || code.length > 50) {
    throw new Error("Emote code phải từ 1-50 ký tự");
  }

  // Validate unique code per scope/channel.
  const existing = await db.emote.findFirst({
    where: { code, channelId: params.channelId ?? null },
  });

  if (existing) {
    throw new Error(`Emote code "${code}" đã tồn tại`);
  }

  return db.emote.create({
    data: {
      code,
      imageUrl: params.imageUrl,
      scope: params.scope,
      channelId: params.scope === "CHANNEL" ? params.channelId : null,
      fileSizeBytes: params.fileSizeBytes ?? 0,
    },
  });
};

/**
 * Xóa emote (soft-disable).
 */
export const deleteEmote = async (emoteId: string, userId: string) => {
  const emote = await db.emote.findUnique({ where: { id: emoteId } });

  if (!emote) throw new Error("Emote không tồn tại");

  // CHANNEL emote: chỉ channel owner xóa.
  // GLOBAL emote: ai cũng xóa được (admin).
  if (emote.scope === "CHANNEL" && emote.channelId !== userId) {
    throw new Error("Bạn không có quyền xóa emote này");
  }

  return db.emote.update({
    where: { id: emoteId },
    data: { status: "DISABLED" },
  });
};

/**
 * Parse message text → replace :code: shortcodes with image metadata.
 *
 * Format: :code: (colon-wrapped word).
 * Code matching is case-sensitive.
 *
 * Returns segments for rendering in ChatMessage.
 */
export const parseEmotesInMessage = (
  message: string,
  emotes: Emote[]
): Array<{ type: "text"; value: string } | { type: "emote"; code: string; imageUrl: string }> => {
  if (!emotes.length) return [{ type: "text", value: message }];

  // Build a map from lower-case code → emote for quick lookup.
  const emoteMap = new Map<string, Emote>();
  for (const e of emotes) {
    emoteMap.set(e.code, e);
  }

  // Escape special chars and build pattern matching :code: format.
  const codePattern = emotes
    .map((e) => e.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // Matches :code: where code is one of the known codes.
  const emoteRegex = new RegExp(`:(${codePattern}):`, "g");

  const result: Array<
    { type: "text"; value: string } | { type: "emote"; code: string; imageUrl: string }
  > = [];
  let lastIdx = 0;

  const matches = Array.from(message.matchAll(emoteRegex));
  for (const match of matches) {
    const start = match.index!;
    const end = start + match[0].length;
    const code = match[1];

    // Text before this emote.
    if (start > lastIdx) {
      result.push({ type: "text", value: message.slice(lastIdx, start) });
    }

    const emote = emoteMap.get(code);
    if (emote) {
      result.push({ type: "emote", code, imageUrl: emote.imageUrl });
    }

    lastIdx = end;
  }

  // Remaining text.
  if (lastIdx < message.length) {
    result.push({ type: "text", value: message.slice(lastIdx) });
  }

  return result.length > 0 ? result : [{ type: "text", value: message }];
};
