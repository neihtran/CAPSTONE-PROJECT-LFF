# 📋 REVIEW ĐỒ ÁN TỐT NGHIỆP - TWITCH CLONE (GameHub)

> **Vai trò:** Giảng viên hướng dẫn đồ án tốt nghiệp
> **Đối tượng:** Sinh viên CNTT chuẩn bị bảo vệ
> **Công nghệ chính:** Next.js 14, React 18, Prisma + MySQL, LiveKit, Clerk, UploadThing, TailwindCSS, TypeScript
> **Ngày review:** 12/09/2026

---

## 🔎 BƯỚC 1 — KIỂM KÊ CHỨC NĂNG HIỆN CÓ

### 1.1. Kiến trúc tổng thể (patterns đang dùng)

| Pattern / Công nghệ | Mô tả | Bằng chứng trong code |
|---|---|---|
| **Next.js App Router** | Routing theo thư mục, route group `(auth)`, `(browse)`, `(dashboard)` | `app/(browse)/*`, `app/(dashboard)/u/[username]/*` |
| **Server Components** | Mặc định fetch dữ liệu phía server, không cần API | `app/(browse)/(home)/_components/results.tsx`, `app/(browse)/[username]/page.tsx` |
| **Server Actions (`"use server"`)** | Xử lý mutation phía server, không cần API endpoint riêng | `actions/follow.ts`, `actions/block.ts`, `actions/stream.ts`, `actions/user.ts`, `actions/ingress.ts`, `actions/token.ts` |
| **Route Handlers (API)** | Webhook + upload file | `app/api/webhooks/clerk/route.ts`, `app/api/webhooks/livekit/route.ts`, `app/api/uploadthing/route.ts` |
| **Middleware (`authMiddleware`)** | Bảo vệ route, cấu hình route công khai | `middleware.ts` |
| **Service Layer** | Tách logic truy vấn DB ra khỏi component | `lib/*-service.ts` (8 services) |
| **State Management (Zustand)** | Quản lý UI state client-side (sidebar collapse, chat sidebar) | `store/use-sidebar.ts`, `store/use-creator-sidebar.ts`, `store/use-chat-sidebar.ts` |
| **Webhooks đồng bộ DB** | Đồng bộ user từ Clerk và trạng thái live từ LiveKit | `app/api/webhooks/clerk/route.ts`, `app/api/webhooks/livekit/route.ts` |
| **Streaming RTMP/WHIP** | Server nhận video stream từ OBS qua LiveKit Ingress | `actions/ingress.ts` dùng `IngressClient` |
| **Real-time chat (WebRTC)** | LiveKit Room kết nối viewer ↔ host | `components/stream-player/index.tsx` bọc `<LiveKitRoom>` |
| **Single-Client Prisma pattern** | Tránh tạo nhiều PrismaClient trong dev | `lib/db.ts` |
| **`@tanstack/react-table`** | Bảng dữ liệu có sort, filter, paginate | `app/(dashboard)/u/[username]/community/_components/data-table.tsx` |

### 1.2. Dịch vụ bên thứ ba đang tích hợp

| Dịch vụ | Mục đích | File liên quan | Ghi chú |
|---|---|---|---|
| **Clerk** | Xác thực (sign-in/sign-up, OAuth) | `middleware.ts`, `app/layout.tsx`, `app/api/webhooks/clerk/route.ts` | Bản thương mại, có free tier |
| **LiveKit Cloud** | Real-time video/chat, RTMP/WHIP ingress | `actions/ingress.ts`, `actions/token.ts`, `components/stream-player/*` | Có free tier (10k phút/tháng) |
| **UploadThing** | Upload thumbnail (ảnh 4MB) | `app/api/uploadthing/*` | Free 2GB/tháng |
| **Svix** | Xác thực chữ ký webhook Clerk | `app/api/webhooks/clerk/route.ts` | Open-source |
| **MySQL (PlanetScale)** | Cơ sở dữ liệu | `prisma/schema.prisma`, `lib/db.ts` | `relationMode = "prisma"` (chuẩn PlanetScale) |
| **TailwindCSS + Radix UI + shadcn/ui** | UI components accessible | `components/ui/*` (12 file) | — |
| **next-themes** | Dark/light mode | `components/theme-toggle.tsx` | — |
| **sonner** | Toast notification | `use-viewer-token.ts`, các action mutation | — |
| **TanStack Table** | Bảng quản lý user bị chặn | `data-table.tsx` | — |

### 1.3. Bảng dữ liệu Prisma và quan hệ

```
User 1──1 Stream
  │
  ├── (1)──(N) Follow (followerId/followingId, self-relation)
  │      • userFollowing: User "đối tượng mình follow"
  │      • userFollowedBy: User "follow mình"
  │
  └── (1)──(N) Block (blockerId/blockedId, self-relation)
         • userBlocking: User "mình chặn"
         • userBlockedBy: User "chặn mình"
```

**4 model:** `User`, `Stream`, `Follow`, `Block`.
**Index:** `Stream(userId)`, `Stream(ingressId)`, full-text `Stream(name)`, `Follow(followerId)`, `Follow(followingId)`, `Block(blockerId)`, `Block(blockedId)`.
**Unique:** `username`, `externalUserId`, `userId(Stream)`, `ingressId(Stream)`, `[followerId, followingId]`, `[blockerId, blockedId]`.

### 1.4. Bảng kiểm kê chức năng

| # | Chức năng | Mô tả | File / Route liên quan | Mức độ |
|---|---|---|---|---|
| 1 | **Xác thực (Auth)** | Đăng nhập/đăng ký qua Clerk, bảo vệ route | `app/(auth)/sign-in`, `app/(auth)/sign-up`, `middleware.ts` | ✅ Đầy đủ |
| 2 | **Đồng bộ user từ Clerk webhook** | Tự tạo User + Stream khi user.created | `app/api/webhooks/clerk/route.ts` | ✅ Đầy đủ |
| 3 | **Dashboard Creator** | Layout riêng cho streamer (route group `(dashboard)`) | `app/(dashboard)/u/[username]/layout.tsx` | ✅ Đầy đủ |
| 4 | **Trang chủ (Home feed)** | Liệt kê stream, ưu tiên live trước | `app/(browse)/(home)/page.tsx`, `lib/feed-service.ts` | ✅ Đầy đủ |
| 5 | **Tìm kiếm** | Tìm theo tên stream + username (fulltext) | `app/(browse)/search/page.tsx`, `lib/search-service.ts` | ✅ Đầy đủ |
| 6 | **Trang stream viewer (`/:username`)** | Xem live, chat, follow | `app/(browse)/[username]/page.tsx`, `components/stream-player/*` | ✅ Đầy đủ |
| 7 | **Stream Player** | Kết nối LiveKit Room, video, chat, fullscreen, volume | `components/stream-player/index.tsx` | ✅ Đầy đủ |
| 8 | **Real-time chat** | Chat qua LiveKit DataChannel, slow mode, follower-only | `components/stream-player/chat*` | ✅ Đầy đủ |
| 9 | **Theo dõi / Bỏ theo dõi** | `onFollow`/`onUnfollow` server action | `actions/follow.ts`, `lib/follow-service.ts`, `components/stream-player/actions.tsx` | ✅ Đầy đủ |
| 10 | **Chặn / Bỏ chặn** | `onBlock`/`onUnblock` kèm remove khỏi LiveKit Room | `actions/block.ts`, `lib/block-service.ts`, `components/stream-player/community-item.tsx` | ✅ Đầy đủ |
| 11 | **Cộng đồng (Community)** | Bảng danh sách user bị chặn + sort/filter/paginate | `app/(dashboard)/u/[username]/community/*` | ✅ Đầy đủ |
| 12 | **Tạo kết nối LiveKit (Ingress)** | Tạo RTMP/WHIP URL cho OBS | `actions/ingress.ts`, `app/(dashboard)/u/[username]/keys/*` | ✅ Đầy đủ |
| 13 | **Đồng bộ trạng thái Live** | Webhook `ingress_started`/`ingress_ended` cập nhật `isLive` | `app/api/webhooks/livekit/route.ts` | ✅ Đầy đủ |
| 14 | **Cập nhật thông tin Stream** | Đổi tên, thumbnail, cài đặt chat | `actions/stream.ts`, `components/stream-player/info-modal.tsx` | ✅ Đầy đủ |
| 15 | **Cập nhật Bio** | Server action update bio user | `actions/user.ts`, `components/stream-player/bio-modal.tsx` | ✅ Đầy đủ |
| 16 | **Upload thumbnail** | Uploadthing dropzone 4MB | `app/api/uploadthing/*`, `components/stream-player/info-modal.tsx` | ✅ Đầy đủ |
| 17 | **Cài đặt Chat (Creator)** | Toggle enable / slow mode / followers-only | `app/(dashboard)/u/[username]/chat/page.tsx` | ✅ Đầy đủ |
| 18 | **Sidebar đề xuất + Following** | Loại trừ user bị chặn, user đã follow (recommended) | `lib/recommended-service.ts`, `lib/follow-service.ts` | ✅ Đầy đủ |
| 19 | **Cộng đồng trong chat (Community tab)** | Danh sách người xem trong room, tìm kiếm, block | `components/stream-player/chat-community.tsx` | ✅ Đầy đủ |
| 20 | **Sidebar toggle/collapse** | Đóng mở sidebar (responsive + state lưu Zustand) | `components/stream-player/chat-toggle.tsx`, `app/(browse)/_components/sidebar/*` | ✅ Đầy đủ |
| 21 | **Dark/Light theme** | next-themes với persist localStorage | `components/theme-toggle.tsx`, `components/providers/theme-provider.tsx` | ✅ Đầy đủ |
| 22 | **404 / Error pages** | Not-found và Error route handlers | `app/not-found.tsx`, `app/error.tsx`, `app/(browse)/[username]/error.tsx`, `not-found.tsx` | ✅ Đầy đủ |
| 23 | **Mobile responsive** | Container collapse sidebar khi < 1024px | `_components/container.tsx`, `useMediaQuery` | ✅ Đầy đủ |

---

## ⚖️ BƯỚC 2 — ĐÁNH GIÁ ĐIỂM MẠNH / YẾU

### 2.1. Điểm cộng kỹ thuật (nên trình bày trong slide)

| # | Điểm mạnh | Chi tiết | File minh chứng |
|---|---|---|---|
| ✅ | **Full-stack Next.js 14 App Router** | Server Components + Server Actions + Middleware — thể hiện hiểu mô hình mới nhất | Toàn bộ `app/`, `actions/`, `middleware.ts` |
| ✅ | **Webhook đồng bộ 2 chiều** | Clerk → DB (user tạo/sửa/xóa) + LiveKit → DB (live started/ended). Đây là pattern production thực sự | `app/api/webhooks/clerk/route.ts`, `app/api/webhooks/livekit/route.ts` |
| ✅ | **LiveKit triển khai đúng kiến trúc** | RTMP/WHIP ingress, AccessToken theo host vs viewer (`host-${id}` vs `${id}`), role `canPublish: false` cho viewer | `actions/token.ts`, `actions/ingress.ts` |
| ✅ | **Phân quyền phía Server** | Tất cả mutation đều qua `getSelf()` lấy user từ Clerk, không tin tưởng client; `hostUsername` kiểm tra khớp Clerk username | `lib/auth-service.ts`, `actions/ingress.ts` |
| ✅ | **Service Layer pattern** | Tách DB query khỏi component & action → dễ test, dễ thay DB | `lib/*-service.ts` |
| ✅ | **Single Prisma Client** | Pattern `globalThis.prisma` chống hot-reload tạo nhiều connection | `lib/db.ts` |
| ✅ | **Prisma relations tự tham chiếu** | `Follow` và `Block` đều self-relation với 2 named relation — thể hiện hiểu về Prisma nâng cao | `prisma/schema.prisma` |
| ✅ | **`relationMode = "prisma"`** | Chuẩn PlanetScale / serverless DB (không dùng FK ở DB) | `prisma/schema.prisma` |
| ✅ | **Full-text search Prisma** | `@@fulltext([name])` đã khai báo + dùng `contains` filter | `prisma/schema.prisma`, `lib/search-service.ts` |
| ✅ | **TanStack Table cho Community** | Sort, filter, paginate hoàn chỉnh (không phải chỉ render thẻ `<table>`) | `data-table.tsx` |
| ✅ | **shadcn/ui tự build** | 12 component (dialog, switch, slider, tooltip, ...) build trên Radix UI — thể hiện custom design system | `components/ui/*` |
| ✅ | **Zustand cho UI state** | 3 store phục vụ collapsible layouts | `store/*` |
| ✅ | **Xử lý lỗi đầy đủ chỗ nhạy cảm** | Tự chặn mình, block user không tồn tại, user chưa follow mà unfollow... | `lib/follow-service.ts`, `lib/block-service.ts` |
| ✅ | **`stringToColor` tự cài** | Hash tên user thành màu chat — không dùng thư viện | `lib/utils.ts` |
| ✅ | **Server-side rendering thật** | Viewer count, recommended feed render phía server | `app/(browse)/(home)/_components/results.tsx` |

### 2.2. Lỗ hổng / Điểm yếu (HỘI ĐỒNG SẼ HỎI VẶN Ở ĐÂY)

| # | Vấn đề | Mức độ | Lý do | Gợi ý trả lời khi bị hỏi |
|---|---|---|---|---|
| ⚠️ | **Không có test nào** | 🔴 Cao | Tìm `*.test.*` → 0 file | "Em sẽ bổ sung test cho service layer trong sprint tiếp. Ưu tiên unit test cho `follow-service` và `block-service` vì logic nghiệp vụ phức tạp nhất." |
| ⚠️ | **Không có input validation** (Zod, yup, ...) | 🔴 Cao | Mọi Server Action chỉ kiểm tra `null` thủ công | "Em dùng Clerk đảm bảo form input cơ bản. Đây là điểm em muốn cải tiến — sẽ tích hợp Zod ở phase 2." |
| ⚠️ | **Không có rate limiting** | 🔴 Cao | Action `onFollow`, `onBlock` có thể bị spam/bruteforce | "Hiện tại em phụ thuộc Clerk middleware. Em dự định tích hợp Upstash Ratelimit nếu deploy production." |
| ⚠️ | **Không có caching strategy rõ ràng** | 🟡 Trung bình | Chỉ dùng `revalidatePath` thủ công; không có Redis/edge cache | "Dùng revalidatePath theo đúng pattern khuyến nghị Next.js 14." |
| ⚠️ | **`error.tsx` và `not-found.tsx` chỉ hiển thị text tĩnh** | 🟡 Trung bình | Không có logging phía server | "Em đang dùng `console.error` để debug; sẽ tích hợp Sentry cho production." |
| ⚠️ | **`recommended-service.ts` không thực sự "recommend"** | 🟡 Trung bình | Chỉ là `findMany orderBy createdAt desc` | "Em nhận thức rõ đây chưa phải recommendation engine thật. Đề xuất ở Bước 3 sẽ giải quyết." |
| ⚠️ | **`search-service.ts` dùng `contains` không tận dụng full-text** | 🟡 Trung bình | Khai báo `@@fulltext` nhưng query vẫn dùng LIKE | "Đây là oversight — sẽ chuyển sang `db.stream.findMany` với `where: { name: { search: term } }` để tận dụng FULLTEXT INDEX." |
| ⚠️ | **Webhook không có idempotency check** | 🟡 Trung bình | Clerk resend webhook có thể tạo user trùng | ✅ **Đã fix:** `app/api/webhooks/clerk/route.ts` giờ check `findUnique` trước mọi thao tác (create/update/delete). Nếu user đã tồn tại (retry), trả 200 + log để Clerk ngừng retry, không throw error. |
| ⚠️ | **`getSelf()` ở nhiều service gây query lặp** | 🟢 Nhẹ | Mỗi service đều gọi lại `currentUser()` → có thể cache qua React `cache()` | "Em sẽ refactor với `React.cache()` trong version tiếp." |
| ⚠️ | **Không có analytics / tracking** | 🟡 Trung bình | Không đo lường engagement | "Đề xuất ở Bước 3 sẽ giải quyết bằng dashboard thống kê." |
| ⚠️ | **`ingress.ts` không kiểm tra input enum** | 🟢 Nhẹ | `parseInt(ingressType)` có thể trả NaN | "Cần validate `ingressType` với Zod enum trước khi parse." |
| ⚠️ | **Không có CI/CD pipeline** (GitHub Actions, Vercel deploy config) | 🟡 Trung bình | Repo không có `.github/workflows` | "Em sẽ deploy lên Vercel + thêm GitHub Actions chạy `npm run lint && build`." |
| ⚠️ | **`package.json` dùng Next.js 14.0.4** | 🟢 Nhẹ | Đã cũ so với 2026 (Next 15) | "Em cố ý giữ 14 để ổn định cho đồ án." |
| ⚠️ | **`README.md` thiếu hướng dẫn architecture** | 🟢 Nhẹ | README chỉ có setup, không có ERD/sơ đồ | "Em sẽ bổ sung mermaid diagram cho ERD và sequence diagram cho webhook flow." |

### 2.3. Đánh giá độ phức tạp so với đồ án

**Tổng quan: PHÙ HỢP cho đồ án tốt nghiệp CNTT, nhưng cần nâng cấp thêm 1-2 "điểm nhấn".**

**Đã đủ sức thuyết phục:**
- Full-stack app thật, không phải demo CRUD đơn giản.
- Tích hợp 6 dịch vụ bên thứ ba (Clerk, LiveKit, UploadThing, Svix, MySQL/PlanetScale, Radix UI).
- Realtime: video streaming + chat qua WebRTC.
- 22/23 chức năng implement đầy đủ UI + Server Action.
- Data layer chuẩn (Prisma + indexed + fulltext + self-relation).
- Auth + Webhook đồng bộ DB theo pattern production.

**Còn thiếu để "ghi điểm 9-10":**
- Không có AI/ML — đồ án 2026 thiếu AI sẽ bị đánh giá lạc hậu.
- Không có analytics dashboard — đồ án tốt nghiệp cần cho thấy tư duy data-driven.
- Thiếu testing & validation — dễ bị hội đồng chất vấn về chất lượng production code.

---

## 🚀 BƯỚC 3 — TÍNH NĂNG NÊN THÊM (ưu tiên 2026)

> Xếp theo thứ tự **khuyến nghị làm trước** ở Bước 4.

### 🥇 3.1. TÓM TẮT STREAM BẰNG AI (AI tích hợp)

- **Vì sao 2026:** Generative AI là xu hướng chủ đạo. Stream dài hàng giờ, 95% người xem không đủ kiên nhẫn → tóm tắt 30 giây tăng giá trị rất lớn.
- **Độ khó:** Trung bình (~4-6 giờ với API có sẵn, ~20 giờ nếu train/pipeline riêng).
- **Điểm nhấn kỹ thuật:** ✅ Có AI, ✅ Có thể show demo trực tiếp (gõ audio → có tóm tắt).
- **Thư viện/API miễn phí:**
  - **AssemblyAI / Deepgram** (free tier 50h audio/tháng) cho STT
  - **OpenAI GPT-4o-mini** hoặc **Google Gemini 2.0 Flash** cho summarization
  - Hoặc **tự host** với `whisper.cpp` + `ollama` nếu muốn open-source 100%
- **Flow đề xuất:**
  1. Webhook LiveKit `ingress_ended` → trigger background job
  2. Lấy recording từ LiveKit Egress API (free 5GB)
  3. Whisper STT → text
  4. GPT/Gemini summarize
  5. Lưu `StreamSummary` vào DB, hiển thị trên trang `/[username]`

### 🥈 3.2. CHAT MODERATION BẰNG AI

- **Vì sao 2026:** Toxic chat là #1 vấn đề của livestream. AI moderation là must-have.
- **Độ khó:** Thấp–Trung bình (~6-10 giờ).
- **Điểm nhấn:** ✅ Real-time AI inference, ✅ Giải quyết pain point cụ thể.
- **Thư viện:**
  - **Perspective API** (Google) — miễn phí, chuyên toxicity
  - **OpenAI Moderation API** — miễn phí, đa dạng (hate, harassment, self-harm, sexual)
- **Flow:** Chat message → Server Action `moderateChat(message)` → API check → nếu toxic thì reject + log + cảnh báo host.

### 🥉 3.3. ANALYTICS DASHBOARD CHO STREAMER

- **Vì sao 2026:** Streamer hiện tại không có dashboard → không biết content nào hot. Đây là feature thương mại rất rõ.
- **Độ khó:** Trung bình (~10-15 giờ).
- **Điểm nhấn:** ✅ Data viz, ✅ Real-world usable, ✅ Thể hiện tư duy product.
- **Tech:**
  - **Recharts** hoặc **Tremor** (open-source, đẹp)
  - Track: viewer count theo phút, follow tăng trong stream, chat volume, top viewers
  - Lưu `StreamSession` với `viewerCountSnapshot` mỗi 30s

### 🏅 3.4. RECOMMENDATION ENGINE THẬT (thay "recommended-service" hiện tại)

- **Vì sao 2026:** Personalized recommendation là xu hướng TikTok/Netflix. Hiện tại code chỉ là `orderBy createdAt desc` — đây là điểm hội đồng chắc chắn hỏi.
- **Độ khó:** Trung bình–Cao (~15-20 giờ).
- **Điểm nhấn:** ✅ Thuật toán riêng, ✅ Có thể trình bày pseudocode.
- **Thuật toán đề xuất (rất học thuật):**
  ```
  Score(u, s) = w1·LiveBoost(s)
             + w2·CategoryMatch(u, s)
             + w3·SocialProof(s.followedBy)
             + w4·Recency(s.updatedAt)
             + w5·LanguageMatch(u, s)
  ```
- **Caching:** Lưu vào DB column `recommendationScore`, refresh mỗi 6h (cron job).

### 🏅 3.5. POLL / PREDICTION REAL-TIME

- **Vì sao 2026:** Twitch đã có, YouTube vừa thêm. Đây là feature "kiếm tiền" của streamer.
- **Độ khó:** Trung bình (~12 giờ).
- **Điểm nhấn:** ✅ Real-time WebSocket, ✅ Có thể mời audience vote, hiển thị bar chart realtime.
- **Tech:** Tận dụng **LiveKit DataChannel** đã có — broadcast poll event + tally. Hoặc dùng **Ably / Pusher** (free tier 200k message/ngày).
- **Flow:** Host tạo poll → broadcast → viewer vote qua chat command → cập nhật real-time bar chart.

### 🏅 3.6. AUTOMATIC TESTING & ZOD VALIDATION

- **Vì sao 2026:** Không có test = đồ án yếu. Hội đồng CNTT rất coi trọng chất lượng code.
- **Độ khó:** Thấp–Trung bình (~6-8 giờ).
- **Điểm nhấn:** ✅ Best practice, ✅ Dễ trình bày.
- **Tech:**
  - **Vitest** (nhanh hơn Jest, native ESM)
  - **Zod** cho validation mọi Server Action input
  - Test service layer (follow, block, stream) — dễ vì DB riêng
- **Demo:** Show `npm run test` chạy 20+ test pass → "đảm bảo business logic đúng".

### 🏅 3.7. CLIP / HIGHLIGHT (15s replay)

- **Vì sao 2026:** Clip là content thứ cấp, viral trên TikTok/Twitter. Streamer cần clip để marketing.
- **Độ khó:** Cao (~20-30 giờ).
- **Điểm nhấn:** ✅ AI phát hiện highlight, ✅ Tích hợp share social.
- **Tech:**
  - **LiveKit Egress** (free 5GB) để record + lưu S3/R2
  - **AI highlight detection**: chat spike → tự động cắt 30s quanh đó
  - Lưu `Clip` entity, hiển thị trên profile streamer

### 🏅 3.8. RATE LIMITING + SECURITY HARDENING

- **Vì sao 2026:** Standard cho mọi app public 2026.
- **Độ khó:** Thấp (~3-5 giờ).
- **Điểm nhấn:** ✅ Bảo mật — chuyên gia hội đồng thích.
- **Tech:**
  - **Upstash Ratelimit** (free 10k request/ngày) + Redis free tier
  - Áp dụng cho `onFollow`, `onBlock`, `onUnblock`, login attempts
  - Helmet-style headers trong Next.js config

---

## 🛣️ BƯỚC 4 — LỘ TRÌNH ĐỀ XUẤT

### 4.1. Nguyên tắc sắp xếp

1. **Nền tảng trước:** Validation/Testing phải làm sớm để các feature sau có đà.
2. **Demo dễ trước:** Những tính năng có thể "show trực tiếp" trong 5 phút bảo vệ nên ưu tiên (AI Summary, Chat Moderation, Analytics).
3. **Tính năng phụ thuộc sau:** Recommendation Engine đặt sau (cần dữ liệu thật).
4. **Stretch goal:** Clip là "ăn 10 điểm" nhưng tốn thời gian → làm cuối nếu dư.

### 4.2. Lộ trình 3 sprint (mỗi sprint ~1 tuần, tổng ~3 tuần)

#### 🟢 SPRINT 1 (1 tuần đầu) — "Nền tảng chất lượng"
> Mục tiêu: dọn lỗ hổng dễ bị chất vấn, không thêm UI mới.

| Thứ tự | Task | Lý do | Demo được? |
|---|---|---|---|
| 1 | **Zod validation** cho mọi Server Action (~3h) | Fix lỗ hổng "không validate input" | ❌ (chỉ show code) |
| 2 | **Vitest + 10 unit test** cho `follow-service`, `block-service`, `stream-service` (~4h) | Fix "không có test" | ✅ `npm test` chạy xanh |
| 3 | **Upstash Ratelimit** cho các action sensitive (~3h) | Fix "không rate limit" | ✅ request spam → blocked |
| 4 | **Webhook idempotency** (~1h) | Fix double-create user từ Clerk | ❌ |
| 5 | **Search dùng FULLTEXT** thay `contains` (~1h) | Fix oversight đã nhận | ✅ search nhanh hơn |

**Kết quả Sprint 1:** Hội đồng hỏi "code chất lượng production?" → trả lời đủ.

---

#### 🟡 SPRINT 2 (1 tuần tiếp) — "Điểm nhấn AI + demo"
> Mục tiêu: có 2-3 feature WOW để demo trực tiếp.

| Thứ tự | Task | Lý do | Demo được? |
|---|---|---|---|
| 1 | **AI Chat Moderation** với OpenAI Moderation API (~6h) | Real-time, fix pain point toxic chat | ✅ Gõ tin nhắn độc → bị chặn |
| 2 | **AI Stream Summary** với Whisper + GPT-4o-mini (~8h) | Generative AI, cảm xúc mạnh | ✅ "Đây là tóm tắt stream 2 tiếng của bạn trong 30 giây" |
| 3 | **Analytics Dashboard** cho streamer (~8h) | Data-driven, sử dụng được thật | ✅ Show biểu đồ viewer count, chat volume |
| 4 | **README + Architecture diagram** (~3h) | Giúp hội đồng hiểu nhanh trong 1 slide | ✅ Mermaid ERD, webhook flow |

**Kết quả Sprint 2:** Có 3 "wow moment" để mở đầu bảo vệ rất tự tin.

---

#### 🔴 SPRINT 3 (tuần cuối) — "Polish + nice-to-have"
> Mục tiêu: thêm tính năng cạnh tranh & đóng gói.

| Thứ tự | Task | Lý do | Demo được? |
|---|---|---|---|
| 1 | **Recommendation Engine thật** với score + cron refresh (~10h) | Thuật toán riêng, học thuật | ✅ Show feed thay đổi sau khi follow user |
| 2 | **Poll / Prediction real-time** qua LiveKit DataChannel (~8h) | Real-time interaction | ✅ Host tạo poll, audience vote, bar chart chạy |
| 3 | **CI/CD** GitHub Actions + deploy preview URL (~3h) | Professional hóa | ✅ Mở URL deploy thật |
| 4 | **Stretch: Clip / Highlight** (chỉ nếu dư thời gian) | Ăn điểm 10 nếu kịp | ⚠️ cắt nếu thiếu giờ |

---

### 4.3. Slide trình bày đề xuất (16-18 slide)

| # | Slide | Nội dung |
|---|---|---|
| 1 | Title | Tên đồ án, tên sinh viên, GVHD |
| 2 | Problem & Motivation | Vì sao xây livestream clone? |
| 3 | Tech stack | Next.js 14 / Clerk / LiveKit / Prisma / Tailwind |
| 4 | Architecture overview | Sơ đồ mermaid: client ↔ Next.js ↔ DB ↔ 3rd party |
| 5 | ERD | 4 model + self-relation của Follow/Block |
| 6 | Auth flow | Clerk → middleware → webhook → DB sync |
| 7 | Streaming flow | OBS → RTMP → LiveKit Ingress → viewers |
| 8 | Realtime chat | WebRTC + DataChannel + role-based |
| 9 | Service layer | 8 services, "tại sao tách" |
| 10 | **DEMO 1:** Auth + Browse | Đăng nhập, home feed, search |
| 11 | **DEMO 2:** Live stream + chat | OBS push, viewer join, chat realtime |
| 12 | **DEMO 3 (Sprint 2):** AI Moderation | Tin nhắn toxic → chặn tự động |
| 13 | **DEMO 4 (Sprint 2):** AI Summary | Stream xong → có tóm tắt 30s |
| 14 | **DEMO 5 (Sprint 2):** Analytics | Dashboard biểu đồ cho streamer |
| 15 | Quality practices | Zod, Vitest, Rate limit, CI/CD |
| 16 | Future work | Recommendation Engine, Poll/Clip |
| 17 | Q&A | Cảm ơn hội đồng |
| 18 | (Backup) Live deployment URL | Mở app thật nếu được hỏi |

---

## 📌 5 CÂU HỎI PHẢN BIỆN HAY GẶP + GỢI Ý TRẢ LỜI

| Câu hỏi | Gợi ý trả lời |
|---|---|
| "Tại sao chọn LiveKit thay vì Agora/Twilio?" | "LiveKit là open-source, self-host được, có RTMP/WHIP ingress tích hợp → đỡ phải viết server streaming." |
| "Webhook có xử lý trùng lặp không?" | "Hiện tại Clerk gửi retry khi lỗi → em nhận thức cần idempotency check, sẽ thêm ở sprint tiếp." |
| "Nếu 1 triệu user cùng follow 1 streamer thì sao?" | "Hiện tại dùng Prisma + MySQL indexed. Production thật sẽ cần cache layer (Redis) và sharding theo streamer." |
| "Search chỉ dùng `LIKE` có chậm không?" | "Đúng — em đã khai báo `@@fulltext` nhưng chưa tận dụng. Đây là điểm sẽ cải tiến." |
| "Có test gì chưa?" | "Em đang bổ sung Vitest cho service layer — ưu tiên logic nghiệp vụ." |
| "Tại sao không dùng WebSocket thuần?" | "LiveKit đã cung cấp DataChannel qua WebRTC — tận dụng chính kết nối video đang có, đỡ phải manage state riêng." |
| "Tại sao tách Server Action với Route Handler?" | "Action cho mutation user-facing (có form), Route Handler cho webhook + upload (cần raw body)." |
| "Bảo mật như thế nào?" | "Auth qua Clerk, role check trong token LiveKit (canPublish=false cho viewer), validate mọi input ở server. Em sẽ bổ sung rate limit và webhook signature verify toàn bộ." |

---

## ✅ CHECKLIST TRƯỚC NGÀY BẢO VỆ

- [ ] Local chạy `npm run dev` thành công, demo không lỗi
- [ ] Tài khoản test (host + viewer) đã tạo sẵn
- [ ] OBS đã cài, scene test đã chuẩn bị
- [ ] Webhook live trên tunnel (`ngrok`) nếu muốn demo webhook
- [ ] Slide đã review bởi 2 người khác
- [ ] Code đã format & lint sạch (`npm run lint`)
- [ ] Tóm tắt các API key/3rd party dùng (đề phòng hỏi)
- [ ] Sơ đồ ERD / kiến trúc đã vẽ bằng mermaid
- [ ] Dự phòng video demo nếu Wi-Fi hỏng

---

## 🎯 TÓM TẮT 1 DÒNG

> Dự án **đã đủ tốt** cho đồ án tốt nghiệp nếu bạn dành **3 tuần** để bổ sung (1) Validation + Testing, (2) AI Moderation + AI Summary, (3) Analytics Dashboard — đây là combo 4 tính năng dễ demo, dễ ghi điểm, và đúng tinh thần công nghệ 2026.
