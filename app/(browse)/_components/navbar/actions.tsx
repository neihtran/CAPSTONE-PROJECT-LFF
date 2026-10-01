import React from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { SignInButton, UserButton, currentUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";

export async function Actions() {
  const user = await currentUser();

  return (
    <div className="flex items-center justify-end gap-x-2 ml-4 lg:ml-0">
      <ThemeToggle />
      {!user && (
        <SignInButton>
          <Button variant="primary">Đăng nhập</Button>
        </SignInButton>
      )}
      {!!user && (
        <div className="flex items-center gap-x-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-primary"
            asChild
          >
            <Link href={`/u/${user.username}`}>
              <Clapperboard className="h-5 w-5 lg:mr-2" />
              <span className="hidden lg:block">Bảng điều khiển</span>
            </Link>
          </Button>
          <NotificationBell />
          <UserButton afterSignOutUrl="/" />
        </div>
      )}
    </div>
  );
}