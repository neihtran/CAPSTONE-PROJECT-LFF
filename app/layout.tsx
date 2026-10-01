import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { SWRegister } from "@/components/push/sw-register";
import { clientEnv, getServerEnv } from "@/lib/env";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: "%s | GameHub",
    default: "GameHub",
  },
  description: "Twitch Clone with Next.js, React.js, TailWindCSS & TypeScript.",
  manifest: "/manifest.json",
  themeColor: "#9146ff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GameHub",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate env vars ngay khi root layout mount.
  // Nếu thiếu → throw ngay tại đây, fail-fast thay vì crash sâu trong code.
  // - clientEnv: validate lúc import (chạy 1 lần khi module load).
  // - getServerEnv(): lazy, chỉ chạy khi gọi hàm này (để tránh crash client bundle).
  // Touch cả 2 để trigger validation.
  void clientEnv;
  getServerEnv();

  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="vi" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            storageKey="gamehub-theme"
          >
            <Toaster theme="system" position="bottom-center" />
            <SWRegister />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}