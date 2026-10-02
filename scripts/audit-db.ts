/**
 * scripts/audit-db.ts
 *
 * Audit script — đọc DB và in ra:
 *   1. Row counts của từng model (29 models).
 *   2. DUPLICATE rows (data thừa cần fix).
 *   3. ORPHAN records (FK trỏ tới row không tồn tại).
 *
 * READ-ONLY: KHÔNG update / delete bất kỳ data nào.
 *
 * Run: `npx tsx scripts/audit-db.ts`
 *
 * Nếu DATABASE_URL không có trong env, file sẽ dùng default (MySQL local).
 */

import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma client — dùng DATABASE_URL từ env, fallback nếu env chưa load.
process.env.DATABASE_URL ??=
  "mysql://twitchuser:twitchpass@localhost:3306/twitch_clone";

const db = new PrismaClient();

// Danh sách 29 model theo thứ tự schema.prisma.
const MODELS = [
  "User",
  "Stream",
  "ChatMessage",
  "MessageReport",
  "Follow",
  "Block",
  "Category",
  "Tag",
  "StreamCategory",
  "StreamTag",
  "StreamModerator",
  "ModerationAction",
  "BannedWord",
  "Clip",
  "Notification",
  "NotificationPreference",
  "SubscriptionTier",
  "Subscription",
  "Donation",
  "StreamSession",
  "StreamView",
  "Emote",
  "StreamAlert",
  "StreamEvent",
  "ViewerRank",
  "ViewerChannelRank",
  "StreamerLevel",
  "EventContribution",
  "PushSubscription",
] as const;

type ModelName = (typeof MODELS)[number];

const header = (s: string) =>
  console.log(`\n=== ${s} ===`);
const line = (s: string) => console.log(`- ${s}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROW COUNTS
// ─────────────────────────────────────────────────────────────────────────────
async function tableCounts() {
  header("TABLE COUNTS");
  for (const m of MODELS) {
    // Prisma model name đã là PascalCase, dùng thẳng.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (db as any)[m.charAt(0).toLowerCase() + m.slice(1)].count();
    line(`${m}: ${count}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DUPLICATE CHECKS
// ─────────────────────────────────────────────────────────────────────────────
async function duplicates() {
  header("DUPLICATES");
  let found = 0;

  // User có nhiều Stream (1 user chỉ nên có 1 stream).
  const multiStreamUsers = await db.$queryRaw<{ userId: string; count: bigint }[]>`
    SELECT userId, COUNT(*) AS count
    FROM Stream
    GROUP BY userId
    HAVING COUNT(*) > 1
  `;
  for (const r of multiStreamUsers) {
    line(`Stream: userId=${r.userId} có ${r.count} streams (⚠ expected 1)`);
    found++;
  }

  // Subscription duplicate ACTIVE cho cùng (subscriber, streamer).
  const dupSubs = await db.$queryRaw<
    { subscriberId: string; streamerId: string; count: bigint }[]
  >`
    SELECT subscriberId, streamerId, COUNT(*) AS count
    FROM Subscription
    WHERE status = 'ACTIVE'
    GROUP BY subscriberId, streamerId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupSubs) {
    line(`Subscription: subscriber=${r.subscriberId} streamer=${r.streamerId} có ${r.count} ACTIVE subs`);
    found++;
  }

  // Follow duplicate.
  const dupFollows = await db.$queryRaw<
    { followerId: string; followingId: string; count: bigint }[]
  >`
    SELECT followerId, followingId, COUNT(*) AS count
    FROM Follow
    GROUP BY followerId, followingId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupFollows) {
    line(`Follow: follower=${r.followerId} following=${r.followingId} có ${r.count} rows`);
    found++;
  }

  // Block duplicate.
  const dupBlocks = await db.$queryRaw<
    { blockerId: string; blockedId: string; count: bigint }[]
  >`
    SELECT blockerId, blockedId, COUNT(*) AS count
    FROM Block
    GROUP BY blockerId, blockedId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupBlocks) {
    line(`Block: blocker=${r.blockerId} blocked=${r.blockedId} có ${r.count} rows`);
    found++;
  }

  // NotificationPreference duplicate (1 user chỉ có 1 pref — schema có @unique).
  const dupPrefs = await db.$queryRaw<{ userId: string; count: bigint }[]>`
    SELECT userId, COUNT(*) AS count
    FROM NotificationPreference
    GROUP BY userId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupPrefs) {
    line(`NotificationPreference: userId=${r.userId} có ${r.count} rows`);
    found++;
  }

  // StreamerLevel duplicate.
  const dupLevels = await db.$queryRaw<{ userId: string; count: bigint }[]>`
    SELECT userId, COUNT(*) AS count
    FROM StreamerLevel
    GROUP BY userId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupLevels) {
    line(`StreamerLevel: userId=${r.userId} có ${r.count} rows`);
    found++;
  }

  // ViewerRank duplicate.
  const dupRanks = await db.$queryRaw<{ userId: string; count: bigint }[]>`
    SELECT userId, COUNT(*) AS count
    FROM ViewerRank
    GROUP BY userId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupRanks) {
    line(`ViewerRank: userId=${r.userId} có ${r.count} rows`);
    found++;
  }

  // StreamAlert duplicate.
  const dupAlerts = await db.$queryRaw<{ streamerId: string; count: bigint }[]>`
    SELECT streamerId, COUNT(*) AS count
    FROM StreamAlert
    GROUP BY streamerId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupAlerts) {
    line(`StreamAlert: streamerId=${r.streamerId} có ${r.count} rows`);
    found++;
  }

  // PushSubscription nhiều rows cho 1 user.
  const dupPush = await db.$queryRaw<{ userId: string; count: bigint }[]>`
    SELECT userId, COUNT(*) AS count
    FROM PushSubscription
    GROUP BY userId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupPush) {
    line(`PushSubscription: userId=${r.userId} có ${r.count} rows`);
    found++;
  }

  // Emote duplicate (code + channelId) — channelId có thể NULL → group nullable riêng.
  const dupEmotes = await db.$queryRaw<
    { code: string; channelId: string | null; count: bigint }[]
  >`
    SELECT code, channelId, COUNT(*) AS count
    FROM Emote
    GROUP BY code, channelId
    HAVING COUNT(*) > 1
  `;
  for (const r of dupEmotes) {
    line(
      `Emote: code=${r.code} channelId=${r.channelId ?? "NULL"} có ${r.count} rows`
    );
    found++;
  }

  // ChatMessage trùng (cùng userId + streamId + text trong 1 giây).
  const dupMessages = await db.$queryRaw<
    {
      userId: string;
      streamId: string;
      text: string;
      count: bigint;
    }[]
  >`
    SELECT userId, streamId, text, COUNT(*) AS count
    FROM ChatMessage
    GROUP BY userId, streamId, text, UNIX_TIMESTAMP(sentAt)
    HAVING COUNT(*) > 1
  `;
  for (const r of dupMessages) {
    line(
      `ChatMessage: user=${r.userId} stream=${r.streamId} text="${r.text.slice(0, 30)}" có ${r.count} trùng trong 1 giây`
    );
    found++;
  }

  if (found === 0) line("✅ Không có duplicate nào.");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORPHAN CHECKS — FK trỏ tới row không tồn tại
// ─────────────────────────────────────────────────────────────────────────────

type OrphanRow = { id: string; reason: string };

async function orphans() {
  let found = 0;
  header("ORPHANS");

  // Hàm tiện ích: in row nếu có orphan.
  const report = (rows: OrphanRow[], label: string) => {
    for (const r of rows) {
      line(`${label}: id=${r.id} — ${r.reason}`);
      found++;
    }
  };

  // ─── Follow ────────────────────────────────────────────────────────────────
  const followOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT f.id AS id, CONCAT('followerId=', f.followerId, ' ', IF(uf.id IS NULL, 'KHONG ton tai', 'OK'), ' | followingId=', f.followingId, ' ', IF(ufg.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM Follow f
    LEFT JOIN User uf ON f.followerId = uf.id
    LEFT JOIN User ufg ON f.followingId = ufg.id
    WHERE uf.id IS NULL OR ufg.id IS NULL
  `;
  report(followOrphans, "Follow");

  // ─── Block ─────────────────────────────────────────────────────────────────
  const blockOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT b.id AS id, CONCAT('blockerId=', b.blockerId, ' ', IF(ub.id IS NULL, 'KHONG ton tai', 'OK'), ' | blockedId=', b.blockedId, ' ', IF(ubd.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM Block b
    LEFT JOIN User ub ON b.blockerId = ub.id
    LEFT JOIN User ubd ON b.blockedId = ubd.id
    WHERE ub.id IS NULL OR ubd.id IS NULL
  `;
  report(blockOrphans, "Block");

  // ─── Stream (userId) ───────────────────────────────────────────────────────
  const streamOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT s.id AS id, CONCAT('userId=', s.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM Stream s
    LEFT JOIN User u ON s.userId = u.id
    WHERE u.id IS NULL
  `;
  report(streamOrphans, "Stream");

  // ─── Donation ──────────────────────────────────────────────────────────────
  const donationOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT d.id AS id,
      CONCAT(
        'donorId=', IFNULL(d.donorId, 'NULL'), ' ',
        IF(d.donorId IS NOT NULL AND ud.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | recipientId=', d.recipientId, ' ',
        IF(ur.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | streamId=', IFNULL(d.streamId, 'NULL'), ' ',
        IF(d.streamId IS NOT NULL AND ds.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM Donation d
    LEFT JOIN User ud ON d.donorId = ud.id
    LEFT JOIN User ur ON d.recipientId = ur.id
    LEFT JOIN Stream ds ON d.streamId = ds.id
    WHERE (d.donorId IS NOT NULL AND ud.id IS NULL)
       OR ur.id IS NULL
       OR (d.streamId IS NOT NULL AND ds.id IS NULL)
  `;
  report(donationOrphans, "Donation");

  // ─── Subscription ─────────────────────────────────────────────────────────
  const subOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT s.id AS id,
      CONCAT(
        'subscriberId=', s.subscriberId, ' ', IF(us.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | streamerId=', s.streamerId, ' ', IF(ust.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | tierId=', s.tierId, ' ', IF(t.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM Subscription s
    LEFT JOIN User us ON s.subscriberId = us.id
    LEFT JOIN User ust ON s.streamerId = ust.id
    LEFT JOIN SubscriptionTier t ON s.tierId = t.id
    WHERE us.id IS NULL OR ust.id IS NULL OR t.id IS NULL
  `;
  report(subOrphans, "Subscription");

  // ─── SubscriptionTier ──────────────────────────────────────────────────────
  const tierOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT t.id AS id, CONCAT('streamerId=', t.streamerId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM SubscriptionTier t
    LEFT JOIN User u ON t.streamerId = u.id
    WHERE u.id IS NULL
  `;
  report(tierOrphans, "SubscriptionTier");

  // ─── Clip ──────────────────────────────────────────────────────────────────
  const clipOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT c.id AS id,
      CONCAT(
        'streamId=', c.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | creatorId=', c.creatorId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM Clip c
    LEFT JOIN Stream s ON c.streamId = s.id
    LEFT JOIN User u ON c.creatorId = u.id
    WHERE s.id IS NULL OR u.id IS NULL
  `;
  report(clipOrphans, "Clip");

  // ─── StreamSession ─────────────────────────────────────────────────────────
  const sessOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT ss.id AS id, CONCAT('streamId=', ss.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM StreamSession ss
    LEFT JOIN Stream s ON ss.streamId = s.id
    WHERE s.id IS NULL
  `;
  report(sessOrphans, "StreamSession");

  // ─── StreamView ────────────────────────────────────────────────────────────
  const viewOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT sv.id AS id,
      CONCAT(
        'sessionId=', sv.sessionId, ' ', IF(ss.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | userId=', IFNULL(sv.userId, 'NULL'), ' ',
        IF(sv.userId IS NOT NULL AND u.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM StreamView sv
    LEFT JOIN StreamSession ss ON sv.sessionId = ss.id
    LEFT JOIN User u ON sv.userId = u.id
    WHERE ss.id IS NULL OR (sv.userId IS NOT NULL AND u.id IS NULL)
  `;
  report(viewOrphans, "StreamView");

  // ─── Notification ──────────────────────────────────────────────────────────
  const notifOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT n.id AS id,
      CONCAT(
        'recipientId=', n.recipientId, ' ', IF(ur.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | actorId=', IFNULL(n.actorId, 'NULL'), ' ',
        IF(n.actorId IS NOT NULL AND ua.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM Notification n
    LEFT JOIN User ur ON n.recipientId = ur.id
    LEFT JOIN User ua ON n.actorId = ua.id
    WHERE ur.id IS NULL OR (n.actorId IS NOT NULL AND ua.id IS NULL)
  `;
  report(notifOrphans, "Notification");

  // ─── ChatMessage ───────────────────────────────────────────────────────────
  const msgOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT cm.id AS id,
      CONCAT(
        'userId=', cm.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | streamId=', cm.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM ChatMessage cm
    LEFT JOIN User u ON cm.userId = u.id
    LEFT JOIN Stream s ON cm.streamId = s.id
    WHERE u.id IS NULL OR s.id IS NULL
  `;
  report(msgOrphans, "ChatMessage");

  // ─── MessageReport ─────────────────────────────────────────────────────────
  const mrOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT mr.id AS id,
      CONCAT(
        'streamId=', mr.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | messageId=', IFNULL(mr.messageId, 'NULL'), ' ',
        IF(mr.messageId IS NOT NULL AND m.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | reportedUserId=', mr.reportedUserId, ' ', IF(ur.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | reporterUserId=', mr.reporterUserId, ' ', IF(urr.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM MessageReport mr
    LEFT JOIN Stream s ON mr.streamId = s.id
    LEFT JOIN ChatMessage m ON mr.messageId = m.id
    LEFT JOIN User ur ON mr.reportedUserId = ur.id
    LEFT JOIN User urr ON mr.reporterUserId = urr.id
    WHERE s.id IS NULL
       OR (mr.messageId IS NOT NULL AND m.id IS NULL)
       OR ur.id IS NULL
       OR urr.id IS NULL
  `;
  report(mrOrphans, "MessageReport");

  // ─── StreamModerator ───────────────────────────────────────────────────────
  const smOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT sm.id AS id,
      CONCAT(
        'streamId=', sm.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | userId=', sm.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM StreamModerator sm
    LEFT JOIN Stream s ON sm.streamId = s.id
    LEFT JOIN User u ON sm.userId = u.id
    WHERE s.id IS NULL OR u.id IS NULL
  `;
  report(smOrphans, "StreamModerator");

  // ─── ModerationAction ──────────────────────────────────────────────────────
  const maOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT ma.id AS id,
      CONCAT(
        'streamId=', ma.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | targetUserId=', ma.targetUserId, ' ', IF(ut.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | actorUserId=', ma.actorUserId, ' ', IF(ua.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM ModerationAction ma
    LEFT JOIN Stream s ON ma.streamId = s.id
    LEFT JOIN User ut ON ma.targetUserId = ut.id
    LEFT JOIN User ua ON ma.actorUserId = ua.id
    WHERE s.id IS NULL OR ut.id IS NULL OR ua.id IS NULL
  `;
  report(maOrphans, "ModerationAction");

  // ─── BannedWord ────────────────────────────────────────────────────────────
  const bwOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT bw.id AS id, CONCAT('streamId=', bw.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM BannedWord bw
    LEFT JOIN Stream s ON bw.streamId = s.id
    WHERE s.id IS NULL
  `;
  report(bwOrphans, "BannedWord");

  // ─── Emote ─────────────────────────────────────────────────────────────────
  const emOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT e.id AS id, CONCAT('channelId=', IFNULL(e.channelId, 'NULL'), ' ', IF(e.channelId IS NOT NULL AND u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM Emote e
    LEFT JOIN User u ON e.channelId = u.id
    WHERE e.channelId IS NOT NULL AND u.id IS NULL
  `;
  report(emOrphans, "Emote");

  // ─── NotificationPreference ────────────────────────────────────────────────
  const npOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT np.id AS id, CONCAT('userId=', np.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM NotificationPreference np
    LEFT JOIN User u ON np.userId = u.id
    WHERE u.id IS NULL
  `;
  report(npOrphans, "NotificationPreference");

  // ─── StreamAlert ───────────────────────────────────────────────────────────
  const saOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT sa.id AS id, CONCAT('streamerId=', sa.streamerId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM StreamAlert sa
    LEFT JOIN User u ON sa.streamerId = u.id
    WHERE u.id IS NULL
  `;
  report(saOrphans, "StreamAlert");

  // ─── StreamEvent ───────────────────────────────────────────────────────────
  const seOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT se.id AS id, CONCAT('streamerId=', IFNULL(se.streamerId, 'NULL'), ' ', IF(se.streamerId IS NOT NULL AND u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM StreamEvent se
    LEFT JOIN User u ON se.streamerId = u.id
    WHERE se.streamerId IS NOT NULL AND u.id IS NULL
  `;
  report(seOrphans, "StreamEvent");

  // ─── EventContribution ─────────────────────────────────────────────────────
  const ecOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT ec.id AS id,
      CONCAT(
        'eventId=', ec.eventId, ' ', IF(se.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | userId=', ec.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM EventContribution ec
    LEFT JOIN StreamEvent se ON ec.eventId = se.id
    LEFT JOIN User u ON ec.userId = u.id
    WHERE se.id IS NULL OR u.id IS NULL
  `;
  report(ecOrphans, "EventContribution");

  // ─── ViewerRank ────────────────────────────────────────────────────────────
  const vrOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT vr.id AS id, CONCAT('userId=', vr.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM ViewerRank vr
    LEFT JOIN User u ON vr.userId = u.id
    WHERE u.id IS NULL
  `;
  report(vrOrphans, "ViewerRank");

  // ─── ViewerChannelRank ─────────────────────────────────────────────────────
  const vcrOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT vcr.id AS id,
      CONCAT(
        'viewerId=', vcr.viewerId, ' ', IF(vr.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | streamerId=', vcr.streamerId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM ViewerChannelRank vcr
    LEFT JOIN ViewerRank vr ON vcr.viewerId = vr.userId
    LEFT JOIN User u ON vcr.streamerId = u.id
    WHERE vr.id IS NULL OR u.id IS NULL
  `;
  report(vcrOrphans, "ViewerChannelRank");

  // ─── StreamerLevel ─────────────────────────────────────────────────────────
  const slOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT sl.id AS id, CONCAT('userId=', sl.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM StreamerLevel sl
    LEFT JOIN User u ON sl.userId = u.id
    WHERE u.id IS NULL
  `;
  report(slOrphans, "StreamerLevel");

  // ─── PushSubscription ─────────────────────────────────────────────────────
  const psOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT ps.id AS id, CONCAT('userId=', ps.userId, ' ', IF(u.id IS NULL, 'KHONG ton tai', 'OK')) AS reason
    FROM PushSubscription ps
    LEFT JOIN User u ON ps.userId = u.id
    WHERE u.id IS NULL
  `;
  report(psOrphans, "PushSubscription");

  // ─── StreamCategory (bảng trung gian) ──────────────────────────────────────
  const scOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT CONCAT(sc.streamId, ':', sc.categoryId) AS id,
      CONCAT(
        'streamId=', sc.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | categoryId=', sc.categoryId, ' ', IF(c.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM StreamCategory sc
    LEFT JOIN Stream s ON sc.streamId = s.id
    LEFT JOIN Category c ON sc.categoryId = c.id
    WHERE s.id IS NULL OR c.id IS NULL
  `;
  report(scOrphans, "StreamCategory");

  // ─── StreamTag (bảng trung gian) ──────────────────────────────────────────
  const stOrphans = await db.$queryRaw<OrphanRow[]>`
    SELECT CONCAT(st.streamId, ':', st.tagId) AS id,
      CONCAT(
        'streamId=', st.streamId, ' ', IF(s.id IS NULL, 'KHONG ton tai', 'OK'),
        ' | tagId=', st.tagId, ' ', IF(t.id IS NULL, 'KHONG ton tai', 'OK')
      ) AS reason
    FROM StreamTag st
    LEFT JOIN Stream s ON st.streamId = s.id
    LEFT JOIN Tag t ON st.tagId = t.id
    WHERE s.id IS NULL OR t.id IS NULL
  `;
  report(stOrphans, "StreamTag");

  if (found === 0) line("✅ Không có orphan nào.");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 DB Audit Script");
  console.log(`📦 DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`🕒 Thời điểm chạy: ${new Date().toISOString()}`);

  try {
    // Ping DB trước.
    await db.$connect();
    console.log("✅ Đã kết nối DB.\n");

    await tableCounts();
    await duplicates();
    await orphans();

    console.log("\n🎯 Hoàn tất audit. Script KHÔNG thay đổi data.");
  } catch (err) {
    console.error("\n❌ Lỗi khi audit:", err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();