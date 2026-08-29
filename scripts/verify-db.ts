import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import { dbAll, dbGet } from "../lib/db";

const REQUIRED_TABLES = [
  "accounts",
  "audit_log",
  "content_insight",
  "demographics",
  "login_attempts",
  "profile_insight",
  "scrape_log",
  "users",
];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi");

  const tables = await dbAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tableNames = new Set(tables.map((table) => table.name));
  const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.has(table));
  if (missingTables.length) throw new Error(`Tabel belum tersedia: ${missingTables.join(", ")}`);

  const user = await dbGet<{ password_hash: string; role: string }>(
    "SELECT password_hash, role FROM users WHERE email = ?",
    [email]
  );
  if (!user) throw new Error(`Administrator tidak ditemukan: ${email}`);
  if (user.role !== "admin") throw new Error(`Role ${email} bukan admin`);
  if (!bcrypt.compareSync(password, user.password_hash)) {
    throw new Error(`Password administrator tidak cocok: ${email}`);
  }

  console.log(`Schema siap: ${REQUIRED_TABLES.length} tabel wajib tersedia`);
  console.log(`Administrator terverifikasi: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
