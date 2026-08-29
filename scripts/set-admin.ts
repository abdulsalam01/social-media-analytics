import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "../lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("ADMIN_EMAIL wajib diisi");
  if (!password || password.length < 8) {
    throw new Error("ADMIN_PASSWORD wajib diisi dan minimal 8 karakter");
  }

  const hash = bcrypt.hashSync(password, 12);
  const existing = await dbGet<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);

  if (existing) {
    await dbRun(
      "UPDATE users SET password_hash = ?, name = ?, role = 'admin' WHERE id = ?",
      [hash, "Administrator", existing.id]
    );
    console.log(`Administrator diperbarui: ${email}`);
  } else {
    await dbRun(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
      [email, hash, "Administrator"]
    );
    console.log(`Administrator dibuat: ${email}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
