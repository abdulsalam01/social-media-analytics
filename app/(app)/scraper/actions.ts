"use server";
import { z } from "zod";
import { dbRun, dbAll } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";

export async function toggleAccountScrape(accountId: number, enabled: boolean) {
  const user = await requireRole(["admin", "editor"]);
  const res = await dbRun(
    "UPDATE accounts SET scrape_enabled = ? WHERE id = ?",
    [enabled ? 1 : 0, accountId]
  );
  if (res.changes === 0) return { ok: false as const, error: "Akun tidak ditemukan" };
  await auditLog(user.id, enabled ? "scrape_enable" : "scrape_disable", "account", accountId);
  return { ok: true as const };
}

export async function togglePostScrape(postId: number, enabled: boolean) {
  const user = await requireRole(["admin", "editor"]);
  const res = await dbRun(
    "UPDATE content_insight SET scrape_enabled = ? WHERE id = ?",
    [enabled ? 1 : 0, postId]
  );
  if (res.changes === 0) return { ok: false as const, error: "Post tidak ditemukan" };
  await auditLog(user.id, enabled ? "scrape_enable" : "scrape_disable", "content_insight", postId);
  return { ok: true as const };
}

const UrlSchema = z.object({
  accountId: z.number().int().positive(),
  scrapeUrl: z.string().url().nullable().optional(),
});

export async function updateScrapeUrl(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const p = UrlSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "URL tidak valid" };
  await dbRun(
    "UPDATE accounts SET scrape_url = ? WHERE id = ?",
    [p.data.scrapeUrl ?? null, p.data.accountId]
  );
  await auditLog(user.id, "update_scrape_url", "account", p.data.accountId);
  return { ok: true as const };
}

export async function getScrapeLogs(accountId: number) {
  await requireRole(["admin", "editor", "viewer"]);
  return dbAll(
    `SELECT id, scraped_at, status, posts_found, posts_updated, error
     FROM scrape_log WHERE account_id = ?
     ORDER BY scraped_at DESC LIMIT 10`,
    [accountId]
  );
}
