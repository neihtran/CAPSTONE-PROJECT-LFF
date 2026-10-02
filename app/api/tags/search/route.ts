import { NextResponse } from "next/server";

import { searchTags } from "@/lib/tag-service";

// Route đọc request.url (searchParams) → bắt buộc dynamic, không build tĩnh.
export const dynamic = "force-dynamic";

/**
 * GET /api/tags/search?q=prefix
 *
 * Autocomplete cho tag input — gợi ý tags có slug/name chứa query.
 * Trả về tối đa 10 tags.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Math.min(
      20,
      Math.max(1, Number(url.searchParams.get("limit") ?? 10))
    );

    if (!query.trim()) {
      return NextResponse.json({ tags: [] }, { status: 200 });
    }

    const tags = await searchTags(query, limit);
    return NextResponse.json({ tags }, { status: 200 });
  } catch (error) {
    console.error("[api/tags/search] Lỗi:", error);
    return NextResponse.json(
      { error: "Không thể search tags", tags: [] },
      { status: 500 }
    );
  }
}
