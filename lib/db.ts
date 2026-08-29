import { createClient, type Client, type Transaction, type InValue } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { ensureSchema } from "./migrations";

declare global {
  // eslint-disable-next-line no-var
  var __libsql: Client | undefined;
}

function open(): Client {
  const remoteUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (remoteUrl && remoteUrl.startsWith("libsql://")) {
    // Remote Turso (production / Vercel)
    return createClient({ url: remoteUrl, authToken, intMode: "number" });
  }

  // Local file (dev / self-host)
  const filePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "data.db");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return createClient({ url: `file:${filePath}`, intMode: "number" });
}

export const db: Client = global.__libsql ?? open();
if (process.env.NODE_ENV !== "production") global.__libsql = db;

/**
 * Bootstrap admin from ADMIN_EMAIL + ADMIN_PASSWORD env if no admin exists.
 * Runs once per process, after schema. Silent no-op if env missing or admin already there.
 */
let adminBootstrapPromise: Promise<void> | null = null;
async function ensureAdminBootstrap(client: Client): Promise<void> {
  if (adminBootstrapPromise) return adminBootstrapPromise;
  adminBootstrapPromise = (async () => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    try {
      const existing = await client.execute({
        sql: "SELECT id FROM users WHERE email = ?",
        args: [email.toLowerCase()],
      });
      if (existing.rows.length > 0) return;
      const hash = bcrypt.hashSync(password, 12);
      await client.batch(
        [{
          sql: "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
          args: [email.toLowerCase(), hash, "Administrator"],
        }],
        "write"
      );
      console.log(`[db] Admin bootstrapped: ${email}`);
    } catch (e) {
      console.error("[db] Admin bootstrap failed:", e);
    }
  })();
  return adminBootstrapPromise;
}

// Kick off schema + admin bootstrap (fire-and-forget). Every helper below awaits ensureSchema
// so the first query blocks until DDL applied. Subsequent calls are no-ops.
(async () => {
  try {
    await ensureSchema(db);
    await ensureAdminBootstrap(db);
  } catch (e) {
    console.error("[db] Init failed:", e);
  }
})();

export type { Transaction };

// ---------- Query helpers (mimic better-sqlite3 API but async) ----------

export async function dbAll<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  await ensureSchema(db);
  const r = await db.execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  await ensureSchema(db);
  const r = await db.execute({ sql, args });
  return (r.rows[0] as unknown as T) ?? undefined;
}

export async function dbRun(sql: string, args: InValue[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  await ensureSchema(db);
  const [r] = await db.batch([{ sql, args }], "write");
  return {
    changes: Number(r.rowsAffected ?? 0),
    lastInsertRowid: Number(r.lastInsertRowid ?? 0),
  };
}

export async function dbExec(sql: string): Promise<void> {
  await ensureSchema(db);
  await db.executeMultiple(sql);
}

/**
 * Run fn inside a write transaction. Auto-commit on success, rollback on throw.
 * Pass tx to helpers to keep operations atomic.
 */
export async function dbTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await ensureSchema(db);
  const tx = await db.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function txAll<T = Record<string, unknown>>(tx: Transaction, sql: string, args: InValue[] = []): Promise<T[]> {
  const r = await tx.execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function txGet<T = Record<string, unknown>>(tx: Transaction, sql: string, args: InValue[] = []): Promise<T | undefined> {
  const r = await tx.execute({ sql, args });
  return (r.rows[0] as unknown as T) ?? undefined;
}

export async function txRun(tx: Transaction, sql: string, args: InValue[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const r = await tx.execute({ sql, args });
  return { changes: Number(r.rowsAffected ?? 0), lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
}

// ---------- Types ----------

export type Platform = "instagram" | "tiktok";
export type Role = "admin" | "editor" | "viewer";

export type Account = {
  id: number;
  name: string;
  platform: Platform;
  handle: string;
  created_at: string;
};

export type User = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  created_at: string;
};

export type ProfileInsight = {
  id: number;
  account_id: number;
  date: string;
  visit_per_day: number;
  reach_per_day: number;
  followers: number;
  followers_growth: number;
  new_followers: number;
  created_at: string;
  updated_at: string;
};

export type ContentInsight = {
  id: number;
  account_id: number;
  post_date: string;
  title: string | null;
  link: string | null;
  profile_visit: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  follows: number;
  reach: number;
  impression: number;
  plays: number;
  engagement: number;
  engagement_rate: number;
  created_at: string;
  updated_at: string;
};

/** True if running against remote Turso; false if local file. Used for backup route to know behavior. */
export function isRemoteDb(): boolean {
  return !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.startsWith("libsql://"));
}
