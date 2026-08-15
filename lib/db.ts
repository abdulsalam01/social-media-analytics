import { createClient, type Client, type Transaction, type InValue } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

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

export type { Transaction };

// ---------- Query helpers (mimic better-sqlite3 API but async) ----------

export async function dbAll<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const r = await db.execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const r = await db.execute({ sql, args });
  return (r.rows[0] as unknown as T) ?? undefined;
}

export async function dbRun(sql: string, args: InValue[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const r = await db.execute({ sql, args });
  return {
    changes: Number(r.rowsAffected ?? 0),
    lastInsertRowid: Number(r.lastInsertRowid ?? 0),
  };
}

export async function dbExec(sql: string): Promise<void> {
  await db.executeMultiple(sql);
}

/**
 * Run fn inside a write transaction. Auto-commit on success, rollback on throw.
 * Pass tx to helpers to keep operations atomic.
 */
export async function dbTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
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
