import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";

/**
 * FULLTEXT search cho Stream.
 *
 * Dùng MySQL MATCH ... AGAINST thay vì LIKE %term%:
 * - LIKE %x% không dùng được index → full table scan.
 * - FULLTEXT dùng inverted index, tốc độ O(log n) ngay cả với 10M rows.
 * - Hỗ trợ ranking theo relevance (MATCH score).
 *
 * Lưu ý MySQL FULLTEXT default:
 * - Minimum token length (innodb_ft_min_token_size) = 3.
 * - Stopwords tiếng Anh mặc định bị bỏ.
 * - Với term < 3 ký tự → fallback LIKE để vẫn có kết quả.
 *
 * Stream.name FULLTEXT (đã có) + User.username + User.bio FULLTEXT (vừa thêm).
 *
 * Triển khai: dùng `$queryRaw` để chạy MATCH ... AGAINST trên bảng Stream và User,
 * lấy về id, sau đó dùng Prisma.findMany thông thường để hydrate đầy đủ
 * fields + apply filter block + filter category + filter isLive.
 */

// Shape trả về — export cho ResultCard dùng.
export type SearchResult = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  isLive: boolean;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    imageUrl: string;
    externalUserId: string;
    bio: string | null;
    createdAt: Date;
    updatedAt: Date;
    blocking?: { blockedId: string }[];
  };
  // Categories của stream (cho badge UI).
  categories?: Array<{
    category: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  // Tags của stream (cho badge UI).
  tags?: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

const STREAM_SELECT = {
  user: true,
  id: true,
  name: true,
  isLive: true,
  thumbnailUrl: true,
  updatedAt: true,
  categories: {
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  tags: {
    include: {
      tag: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} as const;

export type SearchFilters = {
  categorySlug?: string;
  isLive?: boolean;
};

/**
 * Search stream với optional filters.
 *
 * @param term - search query (FULLTEXT hoặc LIKE theo độ dài).
 * @param filters - { categorySlug, isLive }
 *
 * Nếu term rỗng + không có filter → trả về [] (không list hết streams).
 */
export const getSearch = async (
  term?: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> => {
  let userId: string | null = null;

  try {
    const self = await getSelf();
    userId = self.id;
  } catch {
    userId = null;
  }

  // Resolve categorySlug → categoryId nếu có.
  let categoryId: string | null = null;
  if (filters.categorySlug) {
    const cat = await db.category.findUnique({
      where: { slug: filters.categorySlug },
      select: { id: true },
    });
    categoryId = cat?.id ?? null;

    // Slug invalid → trả về rỗng (category không tồn tại).
    if (!categoryId) {
      return [];
    }
  }

  const trimmedTerm = term?.trim() ?? "";
  const useFullText = trimmedTerm.length >= 3;

  if (useFullText) {
    // Sanitize: chỉ giữ chữ cái, số, dấu cách, và một số ký tự Unicode hay dùng.
    // Tránh MySQL FULLTEXT error với operators đặc biệt: + - " * ( ) ~ < >
    const sanitized = trimmedTerm
      .replace(/[+\-*"()~<>@\\\/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!sanitized) {
      return [];
    }

    // Build boolean FULLTEXT expression: "linh tran" → "+linh* +tran*"
    // Mỗi token prefix-matched để match cả tên dài (vd: "linh*" khớp "linhcode").
    const fullTextExpression = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `+${t}*`)
      .join(" ");

    // Bước 1: Tìm Stream theo FULLTEXT trên name.
    const streamHits = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM Stream
       WHERE MATCH(name) AGAINST(${fullTextExpression} IN BOOLEAN MODE)
       ORDER BY isLive DESC, updatedAt DESC
       LIMIT 100`
    );

    // Bước 2: Tìm User theo FULLTEXT trên username/bio.
    const userHits = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM User
       WHERE MATCH(username, bio) AGAINST(${fullTextExpression} IN BOOLEAN MODE)
       LIMIT 100`
    );

    const streamIds = streamHits.map((s) => s.id);
    const userIds = userHits.map((u) => u.id);

    if (streamIds.length === 0 && userIds.length === 0) {
      return [];
    }

    const streams = await db.stream.findMany({
      where: {
        ...(userId
          ? {
              user: {
                NOT: {
                  blocking: {
                    some: {
                      blockedId: userId,
                    },
                  },
                },
              },
            }
          : {}),
        // Filter theo isLive.
        ...(typeof filters.isLive === "boolean"
          ? { isLive: filters.isLive }
          : {}),
        // Filter theo category.
        ...(categoryId
          ? { categories: { some: { categoryId } } }
          : {}),
        OR: [
          { id: { in: streamIds } },
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
        ],
      },
      select: STREAM_SELECT,
      orderBy: [{ isLive: "desc" }, { updatedAt: "desc" }],
    });

    return streams as unknown as SearchResult[];
  }

  // Fallback: term ngắn → LIKE. Cũng sanitize để Prisma không tự escape.
  const sanitized = trimmedTerm
    .replace(/[\\\/]/g, "")
    .replace(/[%_]/g, " ")
    .trim();

  // Nếu không có term VÀ không có filter → trả rỗng (không list toàn bộ streams).
  if (
    !sanitized &&
    !categoryId &&
    typeof filters.isLive !== "boolean"
  ) {
    return [];
  }

  const streams = await db.stream.findMany({
    where: {
      ...(userId
        ? {
            user: {
              NOT: {
                blocking: {
                  some: {
                    blockedId: userId,
                  },
                },
              },
            },
          }
        : {}),
      ...(typeof filters.isLive === "boolean"
        ? { isLive: filters.isLive }
        : {}),
      ...(categoryId
        ? { categories: { some: { categoryId } } }
        : {}),
      ...(sanitized
        ? {
            OR: [
              { name: { contains: sanitized } },
              { user: { username: { contains: sanitized } } },
              { user: { bio: { contains: sanitized } } },
            ],
          }
        : {}),
    },
    select: STREAM_SELECT,
    orderBy: [{ isLive: "desc" }, { updatedAt: "desc" }],
  });

  return streams as unknown as SearchResult[];
};
