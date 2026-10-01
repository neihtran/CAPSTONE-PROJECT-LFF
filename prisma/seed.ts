import { PrismaClient } from "@prisma/client";

/**
 * Seed default categories — chạy 1 lần để có data cho /browse/[category].
 *
 * Categories này fixed (admin manages) — User không tự tạo Category mới.
 * Tags thì user tự tạo (xem tag-service.ts).
 *
 * Idempotent: dùng `upsert` thay vì `create` → chạy nhiều lần không trùng.
 *
 * Chạy: `npx prisma db seed` (đã config trong package.json#prisma).
 */

const db = new PrismaClient();

type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
};

const CATEGORIES: SeedCategory[] = [
  {
    slug: "gaming",
    name: "Gaming",
    description: "Tất cả thể loại game — từ AAA đến indie",
  },
  {
    slug: "music",
    name: "Music & Performing Arts",
    description: "Piano, guitar, ca hát, biểu diễn âm nhạc",
  },
  {
    slug: "esports",
    name: "Esports",
    description: "Thi đấu chuyên nghiệp và giải đấu game",
  },
  {
    slug: "irl",
    name: "In Real Life",
    description: "Vlogs đời thực, du lịch, nấu ăn, ASMR",
  },
  {
    slug: "creative",
    name: "Art & Creative",
    description: "Vẽ digital, thiết kế, thủ công, sáng tạo nội dung",
  },
  {
    slug: "coding",
    name: "Coding & Tech",
    description: "Lập trình, học công nghệ, devlog",
  },
  {
    slug: "just-chatting",
    name: "Just Chatting",
    description: "Trò chuyện cùng cộng đồng, hỏi đáp",
  },
  {
    slug: "education",
    name: "Education",
    description: "Học tập, chia sẻ kiến thức, hội thảo",
  },
  {
    slug: "fitness",
    name: "Fitness & Health",
    description: "Gym, yoga, thiền, sức khỏe",
  },
  {
    slug: "food",
    name: "Food & Drink",
    description: "Nấu ăn, review đồ ăn, đồ uống",
  },
  {
    slug: "news",
    name: "News & Politics",
    description: "Thời sự, thảo luận chính trị, podcast",
  },
  {
    slug: "anime",
    name: "Anime & Manga",
    description: "Xem anime, đọc manga, fanart",
  },
  {
    slug: "retro-gaming",
    name: "Retro Games",
    description: "Game cổ điển, speedrun, ROM hacking",
  },
  {
    slug: "mobile-games",
    name: "Mobile Games",
    description: "Liên Quân, Genshin, PUBG Mobile, ... mobile gaming",
  },
  {
    slug: "tabletop",
    name: "Tabletop & RPG",
    description: "Board game, D&D, tabletop RPG",
  },
  {
    slug: "vtuber",
    name: "VTuber",
    description: "Virtual YouTuber / Streamer ảo",
  },
  {
    slug: "pokemon",
    name: "Pokémon",
    description: "Pokémon games, TCG, lore",
  },
  {
    slug: "minecraft",
    name: "Minecraft",
    description: "Minecraft, mods, multiplayer servers",
  },
  {
    slug: "league-of-legends",
    name: "League of Legends",
    description: "LOL, TFT, Riot Games",
  },
  {
    slug: "valorant",
    name: "Valorant",
    description: "Valorant competitive, ranked matches",
  },
];

/**
 * Helper: chuyển "League of Legends" → "league-of-legends".
 * Dùng khi seed từ CSV/JSON mà không có slug sẵn.
 */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function main() {
  console.log("🌱 Seeding categories...");

  let created = 0;
  let updated = 0;

  for (const cat of CATEGORIES) {
    const slug = cat.slug || slugify(cat.name);
    const result = await db.category.upsert({
      where: { slug },
      create: {
        slug,
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
      },
      update: {
        name: cat.name,
        description: cat.description,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  const total = await db.category.count();
  console.log(
    `✅ Done. Created: ${created}, Updated: ${updated}, Total in DB: ${total}`
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
