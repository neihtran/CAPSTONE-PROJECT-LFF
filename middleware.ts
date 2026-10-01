import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk middleware (v5) — App Router style.
 *
 * Theo Clerk v5: `clerkMiddleware` KHÔNG protect route mặc định → phải khai
 * báo protected routes và gọi `auth.protect()` cho chúng. Các route còn lại
 * (public) đi qua middleware như thường, Clerk vẫn init context để
 * `auth()`/`currentUser()` return null thay vì throw.
 *
 * Migration từ v4 → v5:
 *   - `authMiddleware({ publicRoutes: [...] })` → `clerkMiddleware(async (auth, req) => {...})`
 *   - `publicRoutes` đảo thành `isProtectedRoute` (whitelist protect thay vì danh sách public).
 *   - Routes public (không cần auth): "/", "/[username]" công khai, "/sign-in", "/sign-up",
 *     "/api/webhooks/*", "/api/uploadthing", "/api/realtime/notifications", "/search".
 *   - Routes protected (cần đăng nhập): "/u/*" (dashboard streamer).
 *
 * Lưu ý: matcher ở `config` đã được Clerk khuyến nghị cho v5 — bám sát docs chính thức.
 */
const isProtectedRoute = createRouteMatcher([
  "/u/(.*)", // toàn bộ dashboard streamer
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const session = await auth();
    await session.protect();
  }
});

export const config = {
  // Match tất cả pages + api routes (chuẩn Clerk v5 quickstart).
  matcher: [
    // Skip Next.js internals và static (svg/png/jpg/webp/woff...) trừ khi trong search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};