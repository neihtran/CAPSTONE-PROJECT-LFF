import { db } from "@/lib/db";

/**
 * TagService — quản lý tags user-created.
 *
 * Tags khác Categories:
 *   - Categories: admin-managed, fixed (20 cái đã seed).
 *   - Tags: user-created, free-form (vd: "beginner-friendly", "vietnamese").
 *
 * Slug dùng cho unique lookup + URL. Name là human-readable, vd: "League of Legends".
 */

/**
 * Helper: chuyển "League of Legends" → "league-of-legends".
 * Trim, lowercase, replace non-alphanumeric với dash.
 */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Tìm hoặc tạo tag theo tên. Trả về tag object.
 *
 * Idempotent: dùng `upsert` với slug, không tạo duplicate.
 */
export const upsertTag = async (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name rỗng");

  const slug = slugify(trimmed);
  if (!slug) throw new Error("Tag name không hợp lệ sau khi slugify");

  return db.tag.upsert({
    where: { slug },
    create: { name: trimmed, slug },
    update: {}, // Không update gì nếu đã tồn tại.
  });
};

/**
 * Upsert nhiều tags cùng lúc — dùng khi stream setup submit tags dạng array.
 *
 * @param names - danh sách tag names user gõ (có thể rỗng).
 * @returns Mảng các Tag objects đã upsert.
 */
export const upsertManyTags = async (
  names: string[]
): Promise<Awaited<ReturnType<typeof db.tag.upsert>>[]> => {
  const uniqSlugs = new Set<string>();
  const items: Array<{ name: string; slug: string }> = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    if (!slug || uniqSlugs.has(slug)) continue;
    uniqSlugs.add(slug);
    items.push({ name: trimmed, slug });
  }

  if (items.length === 0) return [];

  // Dùng Promise.all song song → nhanh hơn serial transaction.
  const results = await Promise.all(
    items.map(({ name: n, slug }) =>
      db.tag.upsert({
        where: { slug },
        create: { name: n, slug },
        update: {},
      })
    )
  );

  return results;
};

/**
 * Lấy tags của 1 stream.
 */
export const getStreamTags = async (streamId: string) => {
  const items = await db.streamTag.findMany({
    where: { streamId },
    include: { tag: true },
  });
  return items.map((it) => it.tag);
};

/**
 * Set tags cho 1 stream (replace tất cả tags cũ).
 *
 * Flow:
 *   1. Upsert tất cả tag names user nhập → có Tag objects.
 *   2. Transaction: xóa cũ, tạo mới StreamTag rows.
 */
export const setStreamTags = async (
  streamId: string,
  tagNames: string[]
): Promise<void> => {
  const tags = await upsertManyTags(tagNames);

  await db.$transaction([
    db.streamTag.deleteMany({ where: { streamId } }),
    ...(tags.length > 0
      ? [
          db.streamTag.createMany({
            data: tags.map((tag) => ({ streamId, tagId: tag.id })),
          }),
        ]
      : []),
  ]);
};

/**
 * Search tags theo prefix (cho autocomplete).
 *
 * Tag user mới gõ: "lei" → gợi ý ["League of Legends", "Legend"].
 */
export const searchTags = async (query: string, limit = 10) => {
  const q = query.trim();
  if (!q) return [];

  return db.tag.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { slug: { contains: q.toLowerCase() } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });
};
