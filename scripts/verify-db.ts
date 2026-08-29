import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import { createConfiguredClient } from "./db-client";

const REQUIRED_COLUMNS: Record<string, string[]> = {
  accounts: [
    "id", "name", "platform", "handle", "scrape_enabled", "scrape_url",
    "last_scraped_at", "last_scrape_status", "created_at",
  ],
  audit_log: ["id", "user_id", "action", "entity", "entity_id", "meta", "at"],
  content_insight: [
    "id", "account_id", "post_date", "title", "link", "shortcode", "profile_visit",
    "likes", "comments", "shares", "saves", "reposts", "follows", "reach",
    "impression", "plays", "engagement", "engagement_rate", "scrape_enabled",
    "created_at", "updated_at",
  ],
  demographics: ["id", "account_id", "week_start", "kind", "label", "value"],
  login_attempts: ["id", "email", "ip", "success", "at"],
  profile_insight: [
    "id", "account_id", "date", "visit_per_day", "reach_per_day", "followers",
    "followers_growth", "new_followers", "created_at", "updated_at",
  ],
  scrape_log: ["id", "account_id", "scraped_at", "status", "posts_found", "posts_updated", "error"],
  users: ["id", "email", "password_hash", "name", "role", "created_at"],
};

const REQUIRED_INDEXES = [
  "idx_accounts_platform",
  "idx_audit_at",
  "idx_ci_account_date",
  "idx_ci_account_eng",
  "idx_ci_account_plays",
  "idx_ci_account_rate",
  "idx_ci_account_reach",
  "idx_ci_created",
  "idx_ci_title",
  "idx_demo_lookup",
  "idx_login_email_at",
  "idx_login_ip_at",
  "idx_pi_account_date",
  "idx_scrape_log_account",
];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi");

  const client = createConfiguredClient();
  try {
    const tableResult = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name",
      args: ["table", "sqlite_%"],
    });
    const tableNames = new Set(tableResult.rows.map((row) => String(row.name)));
    const missingTables = Object.keys(REQUIRED_COLUMNS).filter((table) => !tableNames.has(table));
    if (missingTables.length) throw new Error(`Tabel belum tersedia: ${missingTables.join(", ")}`);

    for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const columnResult = await client.execute(`PRAGMA table_info(${table})`);
      const columnNames = new Set(columnResult.rows.map((row) => String(row.name)));
      const missingColumns = requiredColumns.filter((column) => !columnNames.has(column));
      if (missingColumns.length) {
        throw new Error(`Kolom ${table} belum tersedia: ${missingColumns.join(", ")}`);
      }
    }

    const indexResult = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name",
      args: ["index", "sqlite_%"],
    });
    const indexNames = new Set(indexResult.rows.map((row) => String(row.name)));
    const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexNames.has(index));
    if (missingIndexes.length) throw new Error(`Index belum tersedia: ${missingIndexes.join(", ")}`);

    const userResult = await client.execute({
      sql: "SELECT password_hash, role FROM users WHERE email = ?",
      args: [email],
    });
    const user = userResult.rows[0];
    if (!user) throw new Error(`Administrator tidak ditemukan: ${email}`);
    if (user.role !== "admin") throw new Error(`Role ${email} bukan admin`);
    if (typeof user.password_hash !== "string" || !bcrypt.compareSync(password, user.password_hash)) {
      throw new Error(`Password administrator tidak cocok: ${email}`);
    }

    console.log(`Schema terverifikasi dari koneksi baru: ${Object.keys(REQUIRED_COLUMNS).length} tabel`);
    console.log(`Kolom wajib terverifikasi: ${Object.values(REQUIRED_COLUMNS).flat().length}`);
    console.log(`Index terverifikasi: ${REQUIRED_INDEXES.length}`);
    console.log(`Administrator terverifikasi: ${email}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
