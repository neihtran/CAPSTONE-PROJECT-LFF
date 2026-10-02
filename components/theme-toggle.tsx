"use client";

/**
 * ThemeToggle — cycle qua 3 mode: light → dark → system → light.
 *
 * Dùng next-themes (đã có sẵn) để toggle theme.
 * Mặc định "system" theo OS preference; nếu user chọn explicit, lưu localStorage.
 *
 * Icon:
 *   - light: Sun
 *   - dark: Moon
 *   - system: Monitor / Sun + Moon
 */

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Tránh hydration mismatch — chỉ render icon sau khi mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCycle = () => {
    // Lấy theme hiện tại (fallback system nếu chưa set).
    const current: Theme = (theme as Theme) || "system";
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length];
    setTheme(next);
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Đổi giao diện"
        disabled
      >
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  // Quyết định icon theo state hiện tại.
  // Nếu user chọn "system" → hiển thị Monitor icon.
  // Nếu user chọn "light"/"dark" explicit → hiển thị Sun/Moon tương ứng.
  const current: Theme = (theme as Theme) || "system";
  const isSystem = current === "system";
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCycle}
      aria-label={`Theme: ${current} — click để đổi`}
      title={`Hiện tại: ${current} (${isSystem ? "theo OS" : isDark ? "tối" : "sáng"})`}
    >
      {/* Light mode icon: hiển thị khi explicit light */}
      <Sun
        className={`h-5 w-5 transition-all ${
          current === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0"
        } ${current === "system" && !isDark ? "rotate-0 scale-100" : ""}`}
      />
      {/* Dark mode icon */}
      <Moon
        className={`absolute h-5 w-5 transition-all ${
          current === "dark"
            ? "rotate-0 scale-100"
            : "rotate-90 scale-0"
        } ${current === "system" && isDark ? "rotate-0 scale-100" : ""}`}
      />
      {/* System mode icon */}
      <Monitor
        className={`absolute h-5 w-5 transition-all ${
          current === "system" ? "rotate-0 scale-100" : "rotate-90 scale-0"
        }`}
      />
      <span className="sr-only">Chuyển giao diện (sáng/tối/theo OS)</span>
    </Button>
  );
}
