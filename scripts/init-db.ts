import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db, dbGet, dbRun, dbExec } from "../lib/db";

async function main() {
  const schemaPath = path.join(process.cwd(), "lib", "schema.sql");
  const ddl = fs.readFileSync(schemaPath, "utf8");
  await dbExec(ddl);

  // --- Idempotent migrations for pre-existing databases ---
  async function columnExists(table: string, column: string): Promise<boolean> {
    const rows = (await db.execute(`PRAGMA table_info(${table})`)).rows as unknown as Array<{ name: string }>;
    return rows.some((r) => r.name === column);
  }
  if (!(await columnExists("content_insight", "title"))) {
    await dbExec("ALTER TABLE content_insight ADD COLUMN title TEXT");
    console.log("Migrasi: kolom title ditambahkan ke content_insight");
  }
  await dbExec("CREATE INDEX IF NOT EXISTS idx_ci_title ON content_insight(account_id, title COLLATE NOCASE)");

  // updated_at columns (idempotent)
  if (!(await columnExists("profile_insight", "updated_at"))) {
    await dbExec("ALTER TABLE profile_insight ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await dbExec("UPDATE profile_insight SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''");
    console.log("Migrasi: kolom updated_at ditambahkan ke profile_insight");
  }
  if (!(await columnExists("content_insight", "updated_at"))) {
    await dbExec("ALTER TABLE content_insight ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await dbExec("UPDATE content_insight SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''");
    console.log("Migrasi: kolom updated_at ditambahkan ke content_insight");
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPass = process.env.ADMIN_PASSWORD || "changeme123!";
  const adminName = "Administrator";

  const existing = await dbGet<{ id: number }>("SELECT id FROM users WHERE email=?", [adminEmail]);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 12);
    await dbRun(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
      [adminEmail, hash, adminName]
    );
    console.log(`Admin dibuat: ${adminEmail}`);
  } else {
    console.log(`Admin sudah ada: ${adminEmail}`);
  }

  console.log("Database siap.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
