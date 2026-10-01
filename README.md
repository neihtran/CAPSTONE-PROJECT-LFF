# FullStack Twitch Clone: Next.js 14, Livestreaming, React, Prisma, Stripe, Tailwind, MySQL & TypeScript

Credits: [Antonio Erdeljac](https://github.com/AntonioErdeljac)

Key Features:

- 📡 Streaming using RTMP / WHIP protocols
- 🌐 Generating ingress
- 🔗 Connecting Next.js app to OBS
- 🔐 Authentication
- 📸 Thumbnail upload with Uploadthing
- 👀 Live viewer count
- 🚦 Live statuses
- 💬 Real-time chat using sockets
- 🎨 Unique color for each viewer in chat
- 👥 Following system
- 🚫 Blocking system
- 👢 Kicking participants from a stream in real-time
- 🎛️ Streamer / Creator Dashboard
- 🐢 Slow chat mode
- 🔒 Followers only chat mode
- 📴 Enable / Disable chat
- 🔽 Collapsible layout (hide sidebars, chat etc, theatre mode etc.)
- 📚 Sidebar following & recommendations tab
- 🏠 Home page recommending streams, sorted by live first
- 🔍 Search results page with a different layout
- 🔄 Syncing user information to our DB using Webhooks
- 📡 Syncing live status information to our DB using Webhooks
- 🤝 Community tab
- 🎨 Beautiful design
- ⚡ Blazing fast application
- 📄 SSR (Server-Side Rendering)
- 🗺️ Grouped routes & layouts
- 🗃️ MySQL DB with PlanetScale

### Prerequisites

**Node version 18.17 or later**

### Cloning the Repository

```shell
git clone https://github.com/nayak-nirmalya/twitch-clone.git
```

### Install Packages

```shell
npm i
```

### Setup .env File

```js
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=

DATABASE_URL=

LIVEKIT_API_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_WS_URL=

UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
```

### Setup Prisma

Add Database URL (PlanetScale/MySQL)

```shell
npx prisma generate
npx prisma db push
```

### Start the App

```shell
npm run dev
```

## Available Commands

Running commands with npm `npm run [command]`

| command | description                              |
| :------ | :--------------------------------------- |
| `dev`   | Starts a development instance of the app |
| `lint`  | Run typescript lint check with eslint    |
| `build` | Start building app for deployment        |
| `start` | Run build version of app                 |
| `test`  | Run unit tests (Vitest)                  |
| `test:watch` | Run tests in watch mode             |
| `test:ui` | Open Vitest UI in browser               |
| `seed`  | Seed 20 default categories to DB        |

---

## 🚀 Sprint Progress

### Sprint 2 (5 days) — Categories, Tags & Discovery ✅

**Highlights:**
- **20 categories** seeded (Gaming, Music, IRL, Coding, ...): `npm run seed`
- **Tags** (free-form, user-created) with autocomplete API
- **Browse pages**: `/browse` (index) + `/browse/[slug]`
- **Trending page** `/trending` with score-based ranking
- **Search filters**: `?category=...&isLive=1` via URL params
- **CategoryPicker** + **TagPicker** cho streamer dashboard
- **Category badges** hiển thị trên result cards

**New API routes:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/categories` | GET | List all categories (`?trending=1` for top by live count) |
| `/api/tags` | POST | Upsert tags + set for stream (owner only) |
| `/api/tags/search` | GET | Autocomplete (`?q=prefix`) |

**New services:**

| File | Functions |
|------|-----------|
| `lib/category-service.ts` | `getAllCategories`, `getTrendingCategories`, `getCategoryBySlug`, `getStreamsByCategory`, `setStreamCategories` |
| `lib/tag-service.ts` | `slugify`, `upsertTag`, `upsertManyTags`, `getStreamTags`, `setStreamTags`, `searchTags` |
| `lib/trending-service.ts` | `getTrendingStreams`, `getTrending` |

**New pages:**

| Route | Description |
|-------|-------------|
| `/browse` | Grid 20 categories với description |
| `/browse/[slug]` | List streams của 1 category |
| `/trending` | Top streams + Top categories 24h |
| `/u/[username]/categories` | Dashboard quản lý categories + tags |

### Sprint 1 (2 days) — Hardening & Bug Fixes ✅

- 6 edge case bugs fixed (auth, follow, block, feed, search, UI)
- Typed error system (`lib/errors.ts`) — 8 named error classes
- 47/47 unit tests passing (Vitest + Mock Extended)
- Zod env validation (`lib/env.ts`)
- Global ErrorBoundary (`app/error.tsx`)
- Search input sanitization (FULLTEXT + LIKE)

### Sprint 3 (1 day) — Moderation Tools ✅

**Highlights:**
- 3 Prisma models mới: `StreamModerator`, `ModerationAction`, `BannedWord`
- **4 hành động mod**: TIMEOUT (1p–7d), BAN (vĩnh viễn), UNBAN, DELETE_MESSAGE
- **Moderator panel** tại `/u/[username]/moderation` với 3 tabs:
  - Moderators: add/remove (owner only)
  - Mod Log: filter + stats summary
  - AutoMod: Banned words (regex + plain text, REJECT/FILTER)
- **AutoMod service**: check banned words (DB) → REJECT/FILTER action
- **LiveKit integration**: timeout/ban → `removeParticipant` để disconnect
- **Rate limit** strict cho mọi mod action (chống spam)

**Sprint 3 Day 2 — Inline Moderation UI ✅**

- **Context menu trên chat messages**: hover → `⋯` → menu với actions
- **Moderator actions trực tiếp**: Timeout (dialog với presets), Ban, Delete Message
- **Report system**: viewer báo cáo vi phạm qua `POST /api/reports`
- **MessageReport Prisma model**: PENDING → RESOLVED / DISMISSED lifecycle
- **ReportService**: `getStreamReports`, `resolveReport`
- **ChatModerationContext**: pass moderation state từ server page → Chat → ChatMessage
- **`ChatMessageContextMenu`**: context menu popover (mod) / report button (viewer)
- **`TimeoutDialog`**: modal với 6 presets + custom input
- **Report queue API**: `GET /api/reports?streamId&status`, `PATCH` resolve/dismiss

**New APIs:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/users/lookup` | GET | Tìm user theo username (cho add-mod workflow) |
| `/api/reports` | GET | Mod queue: reports PENDING của 1 stream |
| `/api/reports` | POST | Viewer gửi báo cáo vi phạm |
| `/api/reports` | PATCH | Mod resolve/dismiss 1 report |

**New services:**

| File | Functions |
|------|-----------|
| `lib/moderation-actions-service.ts` | `isModeratorOrOwner`, `isStreamOwner`, `timeoutUser`, `banUser`, `unbanUser`, `deleteChatMessage`, `isUserBlockedFromStream`, `getModLog`, `getStreamModerators`, `addModerator`, `removeModerator` |
| `lib/automod-service.ts` | `checkBannedWords` — REJECT/FILTER + fail-open |
| `lib/ai-moderation-service.ts` | `moderateMessage` — OpenAI Moderation API |
| `lib/livekit.ts` | `livekit.removeParticipant`, `livekit.updateRoomMetadata` (lazy SDK load) |
| `lib/report-service.ts` | `getStreamReports`, `getPendingReportCount`, `resolveReport` |

**New pages:**

| Route | Description |
|-------|-------------|
| `/u/[username]/moderation` | Moderator panel: tabs Moderators / Mod Log / AutoMod |

**New UI components:**

| Component | Description |
|-----------|-------------|
| `ChatModerationProvider` | Context provider pass mod state |
| `ChatMessageContextMenu` | Right-click/hover menu: timeout/ban/delete/report |
| `TimeoutDialog` | Modal timeout với presets + custom |
| `ModeratorPanel` | Dashboard tabs container |
| `ModeratorsList` | Add/remove moderators (owner) |
| `ModLogTable` | Filterable mod action history |
| `BannedWordsManager` | CRUD banned words (owner) |
| `Card`, `Badge`, `Tabs` | Custom UI primitives |

**Test coverage:** 10 new tests in `automod-service.test.ts` (57/57 total).

### Sprint 4 (1 day) — Clips System ✅

**Highlights:**
- **Clip Prisma model**: title, videoUrl, thumbnail, viewCount, startTime/endTime, isFeatured
- **HLS player** với custom controls + trim support (startTime → endTime)
- **3 pages**: `/clips` (trending), `/clips/[clipId]` (detail + embed), `/u/[username]/clips` (streamer's clips)
- **Owner controls**: toggle featured, delete clip
- **Creator controls**: delete own clips
- **Open Graph metadata** cho embed share (Twitter player card, OG video)
- **Create clip dialog** từ trang xem stream
- **Clips sidebar** trên stream page

**New APIs:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/clips/[clipId]/og` | GET | Open Graph metadata cho clip (debug/share) |

**New services:**

| File | Functions |
|------|-----------|
| `lib/clip-service.ts` | `createClip`, `getClip`, `listClipsByStream`, `listClipsByCreator`, `listTrendingClips`, `incrementClipView`, `deleteClip`, `toggleClipFeatured` |

**Server actions:**

| Action | Description |
|--------|-------------|
| `createClipAction` | Tạo clip mới (Zod validate + rate limit) |
| `deleteClipAction` | Xóa clip (streamer hoặc creator) |
| `toggleClipFeaturedAction` | Toggle featured (chỉ streamer) |

**New UI components:**

| Component | Description |
|-----------|-------------|
| `ClipPlayer` | HLS player với custom controls, trim support |
| `ClipsGrid` | Grid layout với owner/creator controls |
| `ClipsSection` | Sidebar trên stream page với create dialog trigger |
| `CreateClipDialog` | Modal tạo clip với title + startTime/endTime |

**New pages:**

| Route | Description |
|-------|-------------|
| `/clips` | Top clips trending |
| `/clips/[clipId]` | Clip detail với player + embed metadata |
| `/u/[username]/clips` | Streamer clips với owner controls |

**Test coverage:** 17 new tests in `clip-service.test.ts` (74/74 total).

**Dependencies added:** `hls.js` — HLS playback cho non-Safari browsers.

### Sprint 5 (1 day) — Notifications System ✅

**Highlights:**
- **5 notification types**: FOLLOW / LIVE / CLIP / MODERATION / SYSTEM
- **NotificationPrisma model** với metadata JSON field
- **NotificationPreference model** — user toggle per-type
- **Real-time delivery qua SSE** — push notification ngay khi đang online
- **Notification bell** trên top nav với unread badge
- **Toast integration** với Sonner — click toast → navigate to link
- **Auto-mark all read** khi mở `/notifications` (Gmail behavior)
- **Wire vào flows**: follow/live/clip auto-trigger notifications
- **In-memory pub/sub** (sẽ chuyển Redis trong production)

**New APIs:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/notifications` | GET | List notifications (phân trang + unread count) |
| `/api/notifications` | PATCH | Mark 1 hoặc all as read |
| `/api/notifications/preferences` | GET/PATCH | User preferences |
| `/api/realtime/notifications` | GET | SSE endpoint — server push real-time |

**New services:**

| File | Functions |
|------|-----------|
| `lib/notification-service.ts` | `createNotification`, `listMyNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `getOrCreatePreferences`, `updatePreferences`, `notifyFollow`, `notifyLiveStream`, `notifyClipCreated` |
| `lib/realtime.ts` | In-memory pub/sub: `addSubscription`, `removeSubscription`, `publishNotification`, `getTotalConnections` |

**Wired into:**

| Trigger | Notification Type |
|---------|-------------------|
| `followUser()` | FOLLOW → cho streamer được follow |
| LiveKit webhook `ingress_started` | LIVE → cho tất cả followers (bulk) |
| `createClip()` | CLIP → cho streamer (không tự notify) |

**New UI components:**

| Component | Description |
|-----------|-------------|
| `NotificationBell` | Icon chuông + badge count + dropdown với 15 items |
| `NotificationsList` | Full list grouped by date |
| `PreferencesForm` | Toggle cho 5 types + email global |
| `TopNav` | Global navigation bar với bell + user button |

**New pages:**

| Route | Description |
|-------|-------------|
| `/notifications` | Full list grouped by date, auto-mark all read |
| `/notifications/preferences` | Customize per-type preferences |

### Sprint 7 (1 day) — Subscriptions + Donations + Analytics ✅

**Highlights:**
- **Subscriptions (stub payment)**: tier-based subscribe với mock payment (→ Stripe production ready)
- **Donations**: one-time tip với preset amounts ($1/$5/$10/$20/$50) + message
- **Analytics Dashboard**: thống kê views, hours, peak viewers, revenue, top streams
- **Payment Stub**: mô phỏng Stripe — dễ upgrade lên real Stripe sau này
- **Bar chart UI**: pure CSS/SVG, không cần thư viện nặng
- **Stream sessions**: tự động tạo session khi go live, update stats khi end

**New Prisma models:**
- `SubscriptionTier` — T1/T2/T3 với name, price, color, level
- `Subscription` — subscriber ↔ streamer N-N với status (ACTIVE/EXPIRED/CANCELED)
- `Donation` — one-time tips với message + paymentRef
- `StreamSession` — 1 stream session với peak viewers, duration, revenue
- `StreamView` — per-viewer join/leave log

**New APIs:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/subscriptions/tiers` | GET/POST/PATCH/DELETE | CRUD tiers |
| `/api/subscriptions/me` | GET/POST/DELETE | Subscribe/cancel |
| `/api/donations` | GET/POST | List/create donations |
| `/api/analytics` | GET | Overview + daily + top-streams |

**New services:**

| File | Functions |
|------|-----------|
| `lib/payment-stub.ts` | `createDonationIntent`, `createSubscriptionIntent`, `renewSubscriptionIntent`, `refundPayment` |
| `lib/subscription-service.ts` | `getStreamerTiers`, `subscribeToTier`, `cancelSubscription`, `renewSubscription`, `getStreamerSubscriptions`, `getStreamerSubscriptionRevenue` |
| `lib/donation-service.ts` | `createDonation`, `getRecentDonations`, `getStreamerDonationRevenue`, `getRecentDonationCount` |
| `lib/analytics-service.ts` | `getOverviewStats`, `getDailyStats`, `getTopStreams`, `getRecentActivity`, `startStreamSession`, `endStreamSession`, `logViewerJoin`, `logViewerLeave` |

**New UI:**

| Component | Description |
|-----------|-------------|
| `SubscriptionCard` | Tier card với subscribe button + cancel |
| `SubscriptionTiersGrid` | Grid hiển thị tiers trên profile |
| `SubscriptionDashboard` | Full CRUD tiers + subscriber list |
| `DonateModal` | Preset amounts + custom + message |
| `DonateButton` | Trigger button cho donate modal |
| `StatsOverview` | 8 stat cards với màu sắc |
| `RevenueChart` | Bar chart (views/peak/donation) pure CSS/SVG |
| `TopStreamsTable` | Bảng top streams với revenue |

**New pages:**

| Route | Description |
|-------|-------------|
| `/u/[username]/analytics` | Analytics dashboard với chart |
| `/u/[username]/subscription` | Quản lý subscription tiers |

**Test coverage:** 15 new tests in `subscription-service.test.ts` (103/103 total).

### Sprint 8 (1 day) — Alerts + Emotes + Chat Effects ✅

**Highlights:**
- **Stream Alerts**: popup animations khi có follow/sub/donate/clip
- **AlertQueue**: stack max 3 alerts cùng lúc, auto-dismiss
- **4 Animation styles**: slide-up, pop, fade, bounce
- **Emotes**: global + per-channel emotes với `:code:` shortcode format
- **EmotePicker**: emoji picker panel trong chat
- **EmoteRain**: animated emote bay trên màn hình khi donate/sub
- **Alert wiring**: tự động trigger alerts khi subscribe/donate/follow
- **Alert preferences**: streamer tùy chỉnh bật/tắt alert type, chọn animation style

**New Prisma models:**
- `Emote` — global + per-channel emotes với shortcode
- `StreamAlert` — per-streamer alert config (style, duration, sound)
- `StreamEvent` — platform-wide events (milestone, competition, challenge)

**New services:**

| File | Functions |
|------|-----------|
| `lib/alert-service.ts` | `getAlertConfig`, `updateAlertConfig`, `buildAlert` |
| `lib/emote-service.ts` | `getStreamEmotes`, `getGlobalEmotes`, `createEmote`, `deleteEmote`, `parseEmotesInMessage` |

**New components:**

| Component | Description |
|-----------|-------------|
| `AlertToast` | Single alert popup với 4 animation styles |
| `AlertQueue` | Queue manager — max 3 visible, auto-dismiss |
| `EmotePicker` | Emote picker panel với search |
| `EmoteRain` | Animated emote rain overlay |
| `EmoteText` | Renders `:code:` shortcodes as images in chat |

**New APIs:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/alerts/trigger` | POST | Trigger alert event |

**Test coverage:** 10 new tests in `emote-service.test.ts` + `alert-service.test.ts` (113/113 total).

### Sprint 9 (1 day) — Viewer Rank + Streamer Level + Leaderboard ✅

**Highlights:**
- **Royal Level System**: 6 tiers (PEASANT → EMPEROR) dựa trên tổng donate
- **Streamer Level System**: 6 tiers (NEW → ICON) dựa trên XP formula
- **XP Formula**: `(hours*100) + (followers*10) + (uniqueViewers*5) + (revenue/10)`
- **Per-channel ranks**: rank riêng cho từng streamer (fan club)
- **Auto-rank-up**: tự động cộng wealth/XP và detect level-up
- **Leaderboard page** tại `/ranks`: top 100 donators + streamers
- **Royal Badge**: hiển thị tier icon cạnh username trong chat
- **Royal Badge variants**: compact / default / full (với progress bar)

**Tiers (Viewer):**
| Tier | Wealth Required | Icon |
|------|-----------------|------|
| PEASANT | 0+ | 👤 |
| KNIGHT | 1,000+ | 🛡️ |
| EARL | 5,000+ | 👑 |
| DUKE | 20,000+ | ⚔️ |
| KING | 100,000+ | 👑 |
| EMPEROR | 300,000+ | 🏆 |

**Tiers (Streamer):**
| Tier | XP Required | Icon |
|------|-------------|------|
| NEW | 0+ | 🌱 |
| RISING | 1,000+ | 🌿 |
| POPULAR | 5,000+ | 🌳 |
| FAMOUS | 25,000+ | ⭐ |
| STAR | 100,000+ | 🌟 |
| ICON | 500,000+ | 💎 |

**New Prisma models:**
- `ViewerRank` — global wealth + tier (1 row per user)
- `ViewerChannelRank` — per-streamer rank (1 row per viewer×streamer)
- `StreamerLevel` — XP + level cho streamer

**New services:**

| File | Functions |
|------|-----------|
| `lib/rank-service.ts` | `getTierFromWealth`, `addViewerWealth`, `addChannelWealth`, `getProgressToNextTier`, `getRoyalLeaderboard`, `getStreamerLeaderboard` |
| `lib/streamer-level-service.ts` | `getLevelFromXp`, `recalculateStreamerXp`, `getStreamerLevel`, `getStreamerLeaderboard` |

**New components:**

| Component | Description |
|-----------|-------------|
| `RoyalBadge` | Tier badge với 3 variants |
| `StreamerLevelBadge` | Streamer level badge với 3 variants |
| `RoyalLeaderboard` | Top donators ranking page |
| `StreamerLeaderboard` | Top streamers ranking page |

**New pages:**

| Route | Description |
|-------|-------------|
| `/ranks` | Top 100 donators + streamers leaderboard |

**Test coverage:** 29 new tests in `rank-service.test.ts` + `streamer-level-service.test.ts` (142/142 total).

### Sprint 10 (1 day) — Events Page + PWA + Push ✅

**Highlights:**

#### Events System
- **8 event types**: DONATION_GOAL, SUB_MILESTONE, VIEWER_MILESTONE, FOLLOW_GOAL, CUSTOM, STREAMER_MILESTONE, MONTHLY_COMPETITION, CHALLENGE
- **Auto-progress** khi donation / subscription / follow xảy ra
- **Top contributors** tracking per event (EventContribution model)
- **5 status**: ACTIVE → COMPLETED / EXPIRED / CANCELLED / ENDED
- **Reward system**: cents giveaway + description

#### PWA
- **`/manifest.json`**: app metadata, icons (192/512), theme color
- **`/sw.js` service worker**:
  - Cache strategies (Network-First cho pages/API, Stale-While-Revalidate cho static)
  - Auto-cleanup old caches khi activate
  - Offline fallback page
- **Auto-register** trên root layout

#### Push Notifications
- **Web Push API + VAPID** (admin-generated keys)
- **`pushManager.subscribe`** flow: register SW → request permission → POST to `/api/push/subscribe`
- **Server-side `push-service.ts`**: sendNotification, notifyUser, notifyStreamerLive, notifyDonation
- **Auto-cleanup**: expired endpoints (410 Gone) tự động bị xóa
- **`NotificationPermissionButton`**: UI để bật/tắt, handle tất cả states (loading/granted/denied/unsupported)

**New Prisma models:**
- `EventContribution` — per-user contribution tracking
- `PushSubscription` — endpoint + VAPID keys + preferences

**New services:**

| File | Functions |
|------|-----------|
| `lib/event-service.ts` | `createEvent`, `progressEventFromContribution`, `getEventTopContributors`, `validateEventInput`, `getProgressPct`, `getEventTypeMeta`, `formatEventValue`, `expireOverdueEvents` |
| `lib/push-service.ts` | `saveSubscription`, `removeSubscription`, `sendNotification`, `notifyUser`, `notifyStreamerLive`, `notifyDonation`, `generateVapidKeys` |
| `lib/pwa-client.ts` | `registerServiceWorker`, `requestNotificationPermission`, `subscribeToPush`, `unsubscribeFromPush` |
| `public/sw.js` | Service worker (cache strategies + push handler) |

**New pages:**

| Route | Description |
|-------|-------------|
| `/events` | Top active events + completed events showcase |

**New components:**

| Component | Description |
|-----------|-------------|
| `EventCard` | Event card với progress bar + reward |
| `NotificationPermissionButton` | Bật/tắt push notification button |
| `SWRegister` | Auto-register service worker on mount |

**New API routes:**

| Route | Description |
|-------|-------------|
| `GET /api/push/vapid-key` | Trả về public VAPID key |
| `POST /api/push/subscribe` | Lưu push subscription |
| `DELETE /api/push/subscribe` | Xóa subscription |

**Test coverage:** 26 new tests in `event-service.test.ts` (168/168 total).

**Cấu hình VAPID keys:**
```bash
# 1. Generate keys (chạy 1 lần):
npx web-push generate-vapid-keys

# 2. Thêm vào .env:
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@yourdomain.com

# 3. Restart server.

---

## 🧪 Tests

```bash
npm run test          # 1 run + report
npm run test:watch    # watch mode
npm run test:ui       # browser UI
```

**Coverage:**

| Service | Tests |
|---------|-------|
| `stream-service` | 4 |
| `follow-service` | 12 |
| `block-service` | 11 |
| `chat-service` | 10 |
| `moderation-service` | 10 |
| `automod-service` | 10 |
| `notification-service` | 14 |
| `subscription-service` | 15 |
| `emote-service` | 7 |
| `alert-service` | 3 |
| `rank-service` | 15 |
| `streamer-level-service` | 14 |
| `event-service` | 26 |
| **Total** | **168 / 168 passing** |

---

## 📝 BUGS.md

Tất cả bug audit history, edge cases, fixes — xem [BUGS.md](./BUGS.md).

---
