import { NextResponse } from "next/server";

import { getAllCategories, getTrendingCategories } from "@/lib/category-service";

// Route đọc request.url (searchParams) → bắt buộc dynamic, không build tĩnh.
export const dynamic = "force-dynamic";

/**
 * GET /api/categories
 *
 * Query params:
 *   - trending=1 → trả về top N categories theo số live streams (default off).
 *   - limit=N → limit cho trending (default 10).
 *
 * Response: { categories: Category[] }
 *
 * Categories thay đổi không thường xuyên (admin-managed).
 * Ở Sprint sau có thể wrap với `revalidate=60` để cache.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const trending = url.searchParams.get("trending") === "1";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(50, Math.max(1, Number(limitParam))) : 10;

    const categories = trending
      ? await getTrendingCategories(limit)
      : await getAllCategories();

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    console.error("[api/categories] Lỗi:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách categories", categories: [] },
      { status: 500 }
    );
  }
}
