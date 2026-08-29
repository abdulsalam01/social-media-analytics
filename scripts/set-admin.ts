import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import { ensureSchema } from "../lib/migrations";
import { createConfiguredClient } from "./db-client";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("ADMIN_EMAIL wajib diisi");
  if (!password || password.length < 8) {
    throw new Error("ADMIN_PASSWORD wajib diisi dan minimal 8 karakter");
  }

  const client = createConfiguredClient();
  try {
    await ensureSchema(client);
    const hash = bcrypt.hashSync(password, 12);
    await client.batch(
      [{
        sql: `INSERT INTO users (email, password_hash, name, role)
              VALUES (?, ?, ?, 'admin')
              ON CONFLICT(email) DO UPDATE SET
                password_hash = excluded.password_hash,
                name = excluded.name,
                role = 'admin'`,
        args: [email, hash, "Administrator"],
      }],
      "write"
    );
    console.log(`Administrator dibuat/diperbarui dan committed: ${email}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
