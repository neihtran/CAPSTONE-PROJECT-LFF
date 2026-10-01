import React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Actions() {
  return (
    <div className="flex items-center justify-end gap-x-2">
      <ThemeToggle />
      <NotificationBell />
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-primary"
        asChild
      >
        <Link href="/">
          <LogOut className="h-5 w-5 mr-2" />
          Thoát
        </Link>
      </Button>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
