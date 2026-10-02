import Image from "next/image";
import { Poppins } from "next/font/google";

import { cn } from "@/lib/utils";

const font = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

/**
 * Logo LFF (Live For Fun) — hiển thị trên trang auth.
 * Layout: icon tròn + chữ "LFF" + subtitle "Live For Fun".
 */
export function Logo() {
  return (
    <div className="flex flex-col items-center gap-y-4">
      <div className="bg-white rounded-full p-1">
        <Image src="/lff-logo.png" alt="LFF — Live For Fun" height="80" width="80" />
      </div>
      <div className={cn("flex flex-col items-center", font.className)}>
        <p className="text-xl font-semibold">LFF</p>
        <p className="text-sm text-muted-foreground">Live For Fun</p>
      </div>
    </div>
  );
}