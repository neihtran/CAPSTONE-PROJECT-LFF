/**
 * So sánh Prisma schema vs DB thực tế.
 * - Đếm rows từng model trong DB (qua Prisma)
 * - Đếm tables trong DB (qua $queryRaw - INFORMATION_SCHEMA)
 * - So sánh với schema.prisma
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PREFIX = "[AUDIT-SCHEMA]";

async function main() {
  console.log(`${PREFIX} === So sánh Schema.prisma vs DB ===\n`);

  try {
    // ─── 1. Models trong Prisma schema (hardcoded list) ───
    const schemaModels = [
      "User", "Stream", "ChatMessage", "MessageReport", "Follow", "Block",
      "Category", "Tag", "StreamCategory", "StreamTag", "StreamModerator",
      "ModerationAction", "BannedWord", "Clip", "Notification",
      "NotificationPreference", "SubscriptionTier", "Subscription",
      "Donation", "StreamSession", "StreamView", "Emote", "StreamAlert",
      "StreamEvent", "ViewerRank", "ViewerChannelRank", "StreamerLevel",
      "EventContribution", "PushSubscription"
    ];

    // ─── 2. Tables thực tế trong DB ───
    const tablesRaw = await db.$queryRaw<{ table_name: string }[]>`
        SELECT TABLE_NAME as table_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `;
    const dbTables = tablesRaw.map((t) => t.table_name);

    console.log(`${PREFIX} Schema models: ${schemaModels.length}`);
    console.log(`${PREFIX} DB tables: ${dbTables.length}\n`);

    // ─── 3. Tables thừa trong DB (không có trong schema) ───
    const extraInDb = dbTables.filter((t) => !schemaModels.includes(t));
    console.log(`${PREFIX} ⚠ Tables THỪA trong DB (không có trong schema):`);
    if (extraInDb.length === 0) {
      console.log(`${PREFIX}   (none)`);
    } else {
      for (const t of extraInDb) {
        const count = await db.$queryRawUnsafe<{ c: number }[]>(
          `SELECT COUNT(*) as c FROM \`${t}\``
        );
        console.log(`${PREFIX}   ❌ ${t} — ${count[0].c} rows`);
      }
    }

    // ─── 4. Models thiếu trong DB (có trong schema, không có table) ───
    console.log(`\n${PREFIX} ⚠ Tables THIẾU trong DB (có trong schema, không tồn tại):`);
    const missingInDb = schemaModels.filter((m) => !dbTables.includes(m));
    if (missingInDb.length === 0) {
      console.log(`${PREFIX}   (none)`);
    } else {
      for (const m of missingInDb) {
        console.log(`${PREFIX}   ❌ ${m}`);
      }
    }

    // ─── 5. Đếm rows từng model (qua Prisma) ───
    console.log("\n=== Row counts (Prisma) ===");
    const counts: Record<string, number> = {
      User: await db.user.count(),
      Stream: await db.stream.count(),
      ChatMessage: await db.chatMessage.count(),
      MessageReport: await db.messageReport.count(),
      Follow: await db.follow.count(),
      Block: await db.block.count(),
      Category: await db.category.count(),
      Tag: await db.tag.count(),
      StreamCategory: await db.streamCategory.count(),
      StreamTag: await db.streamTag.count(),
      StreamModerator: await db.streamModerator.count(),
      ModerationAction: await db.moderationAction.count(),
      BannedWord: await db.bannedWord.count(),
      Clip: await db.clip.count(),
      Notification: await db.notification.count(),
      NotificationPreference: await db.notificationPreference.count(),
      SubscriptionTier: await db.subscriptionTier.count(),
      Subscription: await db.subscription.count(),
      Donation: await db.donation.count(),
      StreamSession: await db.streamSession.count(),
      StreamView: await db.streamView.count(),
      Emote: await db.emote.count(),
      StreamAlert: await db.streamAlert.count(),
      StreamEvent: await db.streamEvent.count(),
      ViewerRank: await db.viewerRank.count(),
      ViewerChannelRank: await db.viewerChannelRank.count(),
      StreamerLevel: await db.streamerLevel.count(),
      EventContribution: await db.eventContribution.count(),
      PushSubscription: await db.pushSubscription.count(),
    };

    for (const [name, count] of Object.entries(counts)) {
      const marker = count === 0 ? "  (empty)" : "";
      console.log(`  ${name.padEnd(28)} ${count}${marker}`);
    }

    // ─── 6. Check columns trong DB vs schema (đơn giản) ───
    console.log("\n=== Field comparison (Stream model) ===");
    const streamCols = await db.$queryRaw<{ column_name: string; data_type: string }[]>`
        SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Stream'
        ORDER BY ORDINAL_POSITION
      `;
    console.log(`${PREFIX} DB columns: ${streamCols.length}`);
    for (const c of streamCols) {
      console.log(`  - ${c.column_name} (${c.data_type})`);
    }

    // ─── 7. Summary ───
    console.log("\n=== TỔNG KẾT ===");
    console.log(`${PREFIX} Tables thừa trong DB: ${extraInDb.length}`);
    console.log(`${PREFIX} Tables thiếu trong DB: ${missingInDb.length}`);
    console.log(`${PREFIX} Models có 0 rows: ${Object.entries(counts).filter(([_, c]) => c === 0).length}`);
    console.log(`${PREFIX} Models có >0 rows: ${Object.entries(counts).filter(([_, c]) => c > 0).length}`);
  } catch (err) {
    console.error(`${PREFIX} ❌ Error:`, err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();