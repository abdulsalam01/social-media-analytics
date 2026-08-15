import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { dbGet, dbRun, dbTx, txRun } from "../lib/db";

// ---------- Config ----------
const DAYS = 90;
const CONTENT_EVERY = 2;
const TODAY = new Date();

const BRANDS = [
  { name: "Kopi Kenangan Nusantara", platform: "instagram" as const, handle: "kopikenangan.demo", baseFollowers: 12500, growthPerDay: [8, 25], style: "coffee" },
  { name: "Kopi Kenangan Nusantara", platform: "tiktok" as const,    handle: "kopikenangan.demo", baseFollowers: 8200,  growthPerDay: [15, 40], style: "coffee" },
  { name: "Skincare Nusa Beauty",    platform: "instagram" as const, handle: "nusabeauty.demo",   baseFollowers: 9800,  growthPerDay: [5, 18], style: "beauty" },
  { name: "Skincare Nusa Beauty",    platform: "tiktok" as const,    handle: "nusabeauty.demo",   baseFollowers: 15300, growthPerDay: [20, 60], style: "beauty" },
  { name: "Warung Digital Bang Adi", platform: "instagram" as const, handle: "warungbangadi",     baseFollowers: 4200,  growthPerDay: [2, 10], style: "food" },
];

const TITLE_POOLS: Record<string, string[]> = {
  coffee: [
    "Promo Buy 1 Get 1 Kopi Susu Gula Aren", "Menu Baru: Latte Kopi Gula Merah",
    "Behind the Scene: Roasting Beans Nusantara", "Weekend Vibes: Ngopi Bareng Playlist Indie",
    "Testimoni Customer Kopi Susu Signature", "Kolaborasi Barista dengan Musisi Lokal",
    "Tutorial Latte Art buat Pemula", "Rekomendasi Kopi Cocok buat Buka Puasa",
    "Story: Perjalanan Kopi dari Petani ke Cup", "Giveaway Merchandise Setiap Follower",
    "Menu Signature: Cappuccino Vanilla Malaga", "Info Cabang Baru di Kelapa Gading",
    "Diskon Ramadan 30% All Menu", "Kolaborasi dengan Brand Cookie Lokal",
    "Behind Scene: Meet Our Head Barista",
  ],
  beauty: [
    "Review Serum Vitamin C: Sebelum vs Sesudah", "Tips Skincare buat Kulit Berminyak",
    "Tutorial Makeup Natural Daily", "Launching Sunscreen SPF 50 Formula Baru",
    "GRWM: Get Ready with Me Meeting Kantor", "Kolaborasi dengan Beauty Influencer",
    "Behind the Formula: Ingredient Story", "Skincare Routine 5 Menit buat Anak Kuliah",
    "Testimoni Real: Face Wash Anti Jerawat", "Diskon Flash Sale 12.12",
    "Tutorial: Cara Pakai Toner yang Benar", "Live IG: Q&A dengan Dermatolog",
    "Unboxing Paket Skincare Bundle", "Do's & Dont's Pakai Retinol",
    "Kolaborasi dengan Local Beauty Brand",
  ],
  food: [
    "Menu Spesial Hari Ini: Nasi Uduk Ayam Bakar", "Promo Makan Siang Rp 25.000 All You Can Eat",
    "Behind the Scene: Racikan Bumbu Rahasia", "Kolaborasi dengan Petani Lokal Bogor",
    "Story: Kenapa Kita Pilih Ayam Kampung", "Testimoni Customer: Rasa Rumahan Banget",
    "Menu Baru: Sambal Matah Ikan Dori", "GO-FOOD Promo Diskon 40%",
    "Live Cooking Nasi Goreng Kampung", "Cerita: Warung Bang Adi Sejak 2015",
    "Info Delivery Area Jakarta Selatan", "Menu Anak Sekolah: Bento Rp 15.000",
    "Kolaborasi Chef Lokal Kuliner Betawi", "Behind Kitchen: Meet Our Cook",
    "Promo Bundle Keluarga 4 Porsi Hemat",
  ],
};

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const brandIds: { id: number; style: string; platform: "instagram" | "tiktok"; baseFollowers: number; growthPerDay: [number, number]; name: string }[] = [];
  for (const b of BRANDS) {
    await dbRun("INSERT OR IGNORE INTO accounts (name, platform, handle) VALUES (?, ?, ?)", [b.name, b.platform, b.handle]);
    const row = await dbGet<{ id: number }>("SELECT id FROM accounts WHERE handle = ? AND platform = ?", [b.handle, b.platform]);
    if (row) brandIds.push({ id: row.id, style: b.style, platform: b.platform, baseFollowers: b.baseFollowers, growthPerDay: b.growthPerDay as [number, number], name: b.name });
  }

  // Wipe previous demo data (idempotent)
  for (const b of brandIds) {
    await dbRun("DELETE FROM profile_insight WHERE account_id = ?", [b.id]);
    await dbRun("DELETE FROM content_insight WHERE account_id = ?", [b.id]);
  }

  // Generate + insert (batched via transaction per brand)
  for (const b of brandIds) {
    const rand = mulberry32(b.id * 9973);
    const rint = (lo: number, hi: number) => Math.floor(rand() * (hi - lo + 1)) + lo;
    const isTT = b.platform === "tiktok";
    const titles = TITLE_POOLS[b.style];
    let followers = b.baseFollowers;
    let prevFollowers = followers;

    await dbTx(async (tx) => {
      for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
        const d = new Date(TODAY);
        d.setDate(TODAY.getDate() - dayOffset);
        const iso = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        const weekendMul = dow === 0 || dow === 6 ? 1.4 : 1.0;

        const growth = rint(b.growthPerDay[0], b.growthPerDay[1]);
        followers += growth;
        const visit = Math.floor(rint(50, 200) * weekendMul);
        const reach = Math.floor(rint(300, 1200) * weekendMul);
        // Simulate insertion time = end of that day
        const insertedAt = `${iso} 23:59:00`;
        await txRun(tx,
          `INSERT OR REPLACE INTO profile_insight (account_id, date, visit_per_day, reach_per_day, followers, followers_growth, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, iso, visit, reach, followers, followers - prevFollowers, insertedAt, insertedAt]
        );
        prevFollowers = followers;

        if (dayOffset % CONTENT_EVERY === 0 || rand() < 0.25) {
          const nPosts = rand() < 0.15 ? 2 : 1;
          for (let k = 0; k < nPosts; k++) {
            const title = titles[rint(0, titles.length - 1)];
            const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 40);
            const link = isTT
              ? `https://www.tiktok.com/@${b.name.toLowerCase().replace(/\s+/g, "")}/video/${rint(1000000000, 9999999999)}`
              : `https://www.instagram.com/p/${slug.slice(0, 10)}${rint(100, 999)}/`;

            const baseReach = isTT ? rint(2000, 25000) : rint(500, 5000);
            const reachContent = Math.floor(baseReach * weekendMul);
            const engagementRate = 0.02 + rand() * 0.08;
            const engagement = Math.max(1, Math.floor(reachContent * engagementRate));
            const likes = Math.floor(engagement * 0.65);
            const comments = Math.floor(engagement * 0.12);
            const shares = Math.floor(engagement * 0.10);
            const saves = engagement - likes - comments - shares;
            const impression = Math.floor(reachContent * (1.1 + rand() * 0.6));
            const plays = isTT ? Math.floor(reachContent * (1.3 + rand() * 0.8)) : 0;
            const follows = rint(0, 15);
            const profileVisit = rint(5, 60);

            // Content typically inserted a few hours after post
            const insertedAt = `${iso} ${String(10 + rint(0, 12)).padStart(2, "0")}:${String(rint(0, 59)).padStart(2, "0")}:00`;
            await txRun(tx,
              `INSERT INTO content_insight
               (account_id, post_date, title, link, profile_visit, likes, comments, shares, saves, follows, reach, impression, plays, engagement, engagement_rate, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [b.id, iso, title, link, profileVisit,
               likes, comments, shares, Math.max(0, saves), follows,
               isTT ? 0 : reachContent, isTT ? 0 : impression, plays,
               engagement, engagementRate, insertedAt, insertedAt]
            );
          }
        }
      }
    });
  }

  const counts = (await dbGet<{ accounts: number; profile: number; content: number; with_title: number }>(
    `SELECT
       (SELECT COUNT(*) FROM accounts) AS accounts,
       (SELECT COUNT(*) FROM profile_insight) AS profile,
       (SELECT COUNT(*) FROM content_insight) AS content,
       (SELECT COUNT(*) FROM content_insight WHERE title IS NOT NULL) AS with_title`
  ))!;

  console.log("Demo data ter-seed:");
  console.log(`  Akun          : ${counts.accounts}`);
  console.log(`  Data profil   : ${counts.profile}`);
  console.log(`  Konten        : ${counts.content} (dengan judul: ${counts.with_title})`);
  console.log(`  Rentang       : ${DAYS} hari terakhir`);
  console.log("Login lalu buka /dashboard atau /compare.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
