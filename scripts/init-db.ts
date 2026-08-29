import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import { ensureSchema } from "../lib/migrations";
import { createConfiguredClient } from "./db-client";

async function main() {
  const client = createConfiguredClient();
  try {
    await ensureSchema(client);
    console.log("Semua migrasi schema selesai dan committed.");

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "changeme123!";
    const existing = await client.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [adminEmail],
    });

    if (existing.rows.length === 0) {
      const hash = bcrypt.hashSync(adminPassword, 12);
      await client.batch(
        [{
          sql: "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
          args: [adminEmail, hash, "Administrator"],
        }],
        "write"
      );
      console.log(`Admin dibuat dan committed: ${adminEmail}`);
    } else {
      console.log(`Admin sudah ada: ${adminEmail}`);
    }

    console.log("Database siap.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
