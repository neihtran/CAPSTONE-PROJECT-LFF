import { authMiddleware } from "@clerk/nextjs";

/**
 * Clerk middleware (v4.29) — Pages Router style. Tương thích App Router.
 *
 * publicRoutes: Clerk KHÔNG enforce auth trên các routes này, nhưng
 * VẪN init context để currentUser() return null (không throw).
 *
 * ignoredRoutes: middleware SKIP — dùng cho static files (woff, image)
 * mà Clerk không cần xử lý (tránh warning log "middleware was skipped").
 */
export default authMiddleware({
  publicRoutes: [
    "/",
    "/api/webhooks(.*)",
    "/api/uploadthing",
    "/api/realtime/notifications",
    "/:username",
    "/search",
    "/sign-in(.*)",
    "/sign-up(.*)",
  ],
  ignoredRoutes: [
    "/_next/static/(.*)",
    "/_next/image(.*)",
    "/favicon.ico",
    "/manifest.json",
    "/(.*)\\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)",
  ],
});

export const config = {
  // Match tất cả pages + api routes.
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
