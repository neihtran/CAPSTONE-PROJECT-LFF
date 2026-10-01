"use client";

import { useEffect } from "react";

/**
 * SWRegister — auto-register service worker on mount.
 *
 * Mount vào layout (client component wrapper) để đăng ký SW ngay khi app load.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register on load (defer to not block first paint).
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    });
  }, []);

  return null;
}
