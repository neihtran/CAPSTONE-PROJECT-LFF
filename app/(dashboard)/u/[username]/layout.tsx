import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Metadata } from "next";

import { getSelfByUsername } from "@/lib/auth-service";

import { Navbar } from "./_components/navbar";
import { Sidebar } from "./_components/sidebar";
import { Container } from "./_components/container";
import { StreamerAlertPoller } from "./_components/streamer-alert-poller";

export const metadata: Metadata = {
  title: "Bảng điều khiển",
};

export default async function CreatorLayout({
  children,
  params: { username },
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const self = await getSelfByUsername(username);

  if (!self) redirect("/");

  return (
    <>
      <Navbar />
      {/* Banner LIVE — fix bug "streamer dashboard chưa có banner LIVE".
          Hiện ngay dưới navbar (sticky, không che content) khi stream.isLive=true.
          Vì layout là server component → fetch isLive trực tiếp qua getSelfByUsername. */}
      {self.stream?.isLive && (
        <div className="sticky top-20 z-30 bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          BẠN ĐANG LIVE —{" "}
          <Link href={`/${self.username}`} className="underline">
            Về stream
          </Link>
        </div>
      )}
      {/* Fallback polling cho streamer notification khi KHÔNG ở trong LiveKit room.
          Khi ở (home) page, Streamer đã join room → LiveKit Data Channel hoạt động.
          Ở các page khác (/keys, /analytics...) → dùng polling 5s. */}
      <StreamerAlertPoller />
      <div className="flex h-full pt-20">
        <Sidebar />
        <Container>{children}</Container>
      </div>
    </>
  );
}
