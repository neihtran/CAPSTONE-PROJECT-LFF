import React from "react";
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
