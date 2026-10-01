import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getUserByUsername } from "@/lib/user-service";
import { getAllCategories } from "@/lib/category-service";
import { getStreamTags } from "@/lib/tag-service";
import { db } from "@/lib/db";
import { CategoryPicker } from "@/components/stream/category-picker";
import { TagPicker } from "@/components/stream/tag-picker";

/**
 * Dashboard /u/[username]/categories — cho phép streamer edit categories + tags.
 *
 * 2 sections:
 *   1. Categories (tối đa 5, fixed list admin-managed).
 *   2. Tags (free-form, tối đa 20, user-created).
 *
 * Owner-only: check user.username matches currentUser.username.
 */
export const dynamic = "force-dynamic";

export default async function CategoriesDashboardPage({
  params: { username },
}: {
  params: { username: string };
}) {
  const externalUser = await currentUser();
  const user = await getUserByUsername(username);

  if (!user || user.externalUserId !== externalUser?.id || !user.stream) {
    redirect("/");
  }

  // Load data song song.
  const [categories, streamTags, streamCategories] = await Promise.all([
    getAllCategories(),
    getStreamTags(user.stream.id),
    db.streamCategory.findMany({
      where: { streamId: user.stream.id },
      include: { category: true },
    }),
  ]);

  const selectedCategoryIds = streamCategories.map((sc) => sc.categoryId);
  const currentTagNames = streamTags.map((t) => t.name);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Categories &amp; Tags</h1>
        <p className="text-muted-foreground text-sm">
          Quản lý thể loại và tags cho stream của bạn. Tags giúp viewer tìm
          kiếm chính xác hơn; categories giúp stream hiển thị ở đúng mục.
        </p>
      </div>

      <section className="bg-card rounded-lg border p-6">
        <CategoryPicker
          initialCategories={categories}
          initialSelectedIds={selectedCategoryIds}
        />
      </section>

      <section className="bg-card rounded-lg border p-6">
        <TagPicker initialTags={currentTagNames} />
      </section>
    </div>
  );
}
