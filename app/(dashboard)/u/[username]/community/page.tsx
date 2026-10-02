import React from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Heart, UserX, Users } from "lucide-react";

import { getBlockedUsers } from "@/lib/block-service";
import { getFollowers, getFollowerCount } from "@/lib/follow-service";
import { getSelf } from "@/lib/auth-service";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";

import { DataTable } from "./_components/data-table";
import { columns } from "./_components/columns";

/**
 * /u/[username]/community — Quản lý cộng đồng.
 *
 * Layout: 2 tabs (Tabs component tự build).
 *   - Followers: danh sách người theo dõi mình + trạng thái live.
 *   - Blocked: danh sách người đã chặn.
 *
 * Vì sao không dùng shadcn Tabs:
 *   - Để tránh tăng dep size. Tự build bằng anchor + searchParams.
 */
export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "blocked" ? "blocked" : "followers";

  // Fetch song song. Wrap getFollowers trong try/catch để không crash UI nếu DB lỗi.
  const [self, blockedUsers, followersResult, followerCount] = await Promise.all([
    getSelf(),
    getBlockedUsers(),
    getFollowers().catch((err) => {
      console.error("[CommunityPage] getFollowers failed:", err);
      return [] as Awaited<ReturnType<typeof getFollowers>>;
    }),
    getFollowerCount(),
  ]);
  const followers = followersResult;

  // Server-side guard: chỉ streamer mới được xem.
  if (!self || self.username !== params.username) {
    return (
      <div className="p-6">
        <p>Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  const blockedData = blockedUsers.map((block) => ({
    ...block,
    userId: block.blocked.id,
    imageUrl: block.blocked.imageUrl,
    username: block.blocked.username,
    createdAt: format(new Date(block.blocked.createdAt), "dd/MM/yyyy"),
  }));

  const followerData = followers.map((f) => ({
    id: f.id,
    userId: f.user.id,
    username: f.user.username,
    imageUrl: f.user.imageUrl,
    isLive: f.user.isLive,
    followedAt: format(new Date(f.createdAt), "dd/MM/yyyy"),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Cộng đồng của bạn
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý người theo dõi và người đã chặn.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-pink-600">
            <Heart className="h-4 w-4 fill-current" />
            <span className="text-sm font-medium">Người theo dõi</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {followerCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-rose-600">
            <UserX className="h-4 w-4" />
            <span className="text-sm font-medium">Đã chặn</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {blockedUsers.length.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        <TabLink
          href={`/u/${params.username}/community?tab=followers`}
          active={tab === "followers"}
          count={followerCount}
        >
          <Heart className="h-4 w-4 mr-1.5" />
          Người theo dõi
        </TabLink>
        <TabLink
          href={`/u/${params.username}/community?tab=blocked`}
          active={tab === "blocked"}
          count={blockedUsers.length}
        >
          <UserX className="h-4 w-4 mr-1.5" />
          Đã chặn
        </TabLink>
      </div>

      {/* Content */}
      {tab === "followers" ? (
        <FollowerList data={followerData} />
      ) : (
        <DataTable columns={columns} data={blockedData} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function TabLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
      }`}
    >
      {children}
      <Badge variant={active ? "default" : "secondary"} className="ml-2">
        {count}
      </Badge>
    </Link>
  );
}

function FollowerList({
  data,
}: {
  data: Array<{
    id: string;
    userId: string;
    username: string;
    imageUrl: string;
    isLive: boolean;
    followedAt: string;
  }>;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <Heart className="h-10 w-10 mx-auto text-muted-foreground/30" />
        <p className="mt-4 text-muted-foreground">
          Chưa có ai theo dõi bạn. Hãy tạo nội dung hay để thu hút người xem!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="divide-y">
        {data.map((f) => (
          <Link
            key={f.id}
            href={`/${f.username}`}
            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                username={f.username}
                imageUrl={f.imageUrl}
                isLive={f.isLive}
              />
              <div>
                <p className="font-medium">@{f.username}</p>
                <p className="text-xs text-muted-foreground">
                  Theo dõi từ {f.followedAt}
                </p>
              </div>
            </div>
            {f.isLive && (
              <Badge variant="destructive" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                LIVE
              </Badge>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
