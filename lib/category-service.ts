import { db } from "@/lib/db";

/**
 * CategoryService — quản lý danh mục stream (Gaming, Music, IRL...).
 *
 * Categories là FIXED (admin-managed), 20 cái default đã seed qua `npm run seed`.
 * User không tự tạo Category mới — chỉ pick từ list có sẵn khi stream.
 */

/**
 * Lấy tất cả categories, sort A-Z.
 * Dùng cho picker, sidebar, /browse.
 */
export const getAllCategories = async () => {
  return db.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
    },
  });
};

/**
 * Lấy top N categories theo số stream live hiện tại.
 *
 * Trending logic đơn giản: đếm live streams trong mỗi category, sort giảm dần.
 * Không cần time-window cho 2-week MVP — khi data lớn sẽ thay bằng
 * "category with most streams went live in last 24h".
 */
export const getTrendingCategories = async (limit = 10) => {
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      _count: {
        select: {
          streams: true,
        },
      },
    },
  });

  // Đếm live streams cho mỗi category riêng (Prisma _count không filter by relation field).
  const result = await Promise.all(
    categories.map(async (cat) => {
      const liveCount = await db.streamCategory.count({
        where: {
          categoryId: cat.id,
          stream: { isLive: true },
        },
      });
      return { ...cat, liveCount };
    })
  );

  return result
    .sort((a, b) => b.liveCount - a.liveCount)
    .slice(0, limit);
};

/**
 * Lấy 1 category theo slug.
 * Trả về null nếu không tồn tại.
 */
export const getCategoryBySlug = async (slug: string) => {
  return db.category.findUnique({
    where: { slug },
  });
};

/**
 * Lấy streams của 1 category, sort live trước.
 *
 * @param slug - category slug (URL-friendly, vd: "gaming").
 * @param viewerId - optional, dùng để filter block mutual.
 * @param limit - max số streams trả về (default 30).
 */
export const getStreamsByCategory = async (
  slug: string,
  options: {
    viewerId?: string | null;
    limit?: number;
  } = {}
) => {
  const { viewerId = null, limit = 30 } = options;

  const category = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!category) {
    return [];
  }

  return db.stream.findMany({
    where: {
      categories: {
        some: { categoryId: category.id },
      },
      // Exclude block mutual nếu có viewerId.
      ...(viewerId
        ? {
            user: {
              NOT: {
                blocking: {
                  some: {
                    blockedId: viewerId,
                  },
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      isLive: true,
      isChatEnabled: true,
      isChatDelayed: true,
      isChatFollowersOnly: true,
      user: true,
    },
    orderBy: [{ isLive: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
};

/**
 * Set categories cho 1 stream (replace tất cả categories cũ).
 *
 * Dùng khi streamer edit stream setup.
 * Side effect: xóa categories cũ, tạo mới — atomic qua `db.$transaction`.
 */
export const setStreamCategories = async (
  streamId: string,
  categoryIds: string[]
): Promise<void> => {
  await db.$transaction([
    db.streamCategory.deleteMany({ where: { streamId } }),
    db.streamCategory.createMany({
      data: categoryIds.map((categoryId) => ({ streamId, categoryId })),
    }),
  ]);
};
