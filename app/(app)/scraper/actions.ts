"use server";
import { z } from "zod";
import { dbRun, dbAll, dbGet } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";
import { extractPostIdFromUrl, runScrapeForPost } from "@/lib/scraper";
import { getAccountIdForContent, hasAccountAccess } from "@/lib/account-access";

export async function toggleAccountScrape(accountId: number, enabled: boolean) {
  const user = await requireRole(["admin", "editor"]);
  if (!(await hasAccountAccess(user, accountId))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };
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
  const accountId = await getAccountIdForContent(postId);
  if (!accountId || !(await hasAccountAccess(user, accountId))) return { ok: false as const, error: "Post tidak ditemukan atau akses ditolak" };
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
  if (!(await hasAccountAccess(user, p.data.accountId))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };
  await dbRun(
    "UPDATE accounts SET scrape_url = ? WHERE id = ?",
    [p.data.scrapeUrl ?? null, p.data.accountId]
  );
  await auditLog(user.id, "update_scrape_url", "account", p.data.accountId);
  return { ok: true as const };
}

const AddTrackedUrlSchema = z.object({
  url: z.string().url("URL tidak valid"),
  account_id: z.number().int().positive(),
  title: z.string().trim().max(200).optional(),
});

/**
 * Add a single post URL to content_insight and immediately scrape it.
 * Verifies platform matches account.
 */
export async function addTrackedPostUrl(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const p = AddTrackedUrlSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Input tidak valid" };
  if (!(await hasAccountAccess(user, p.data.account_id))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };

  const extracted = extractPostIdFromUrl(p.data.url);
  if (!extracted) return { ok: false as const, error: "URL tidak dikenali (harus Instagram post/reel atau TikTok video)" };

  const account = await dbGet<{ id: number; platform: string }>(
    "SELECT id, platform FROM accounts WHERE id = ?",
    [p.data.account_id]
  );
  if (!account) return { ok: false as const, error: "Akun tidak ditemukan" };
  if (account.platform !== extracted.platform) {
    return { ok: false as const, error: `URL adalah ${extracted.platform} tapi akun ${account.platform}` };
  }

  // Check duplicate
  const existing = await dbGet<{ id: number }>(
    "SELECT id FROM content_insight WHERE account_id = ? AND shortcode = ?",
    [p.data.account_id, extracted.id]
  );
  if (existing) {
    // Just trigger a scrape
    const res = await runScrapeForPost(existing.id, user.id);
    return {
      ok: res.status === "ok",
      post_id: existing.id,
      duplicate: true,
      matched: res.matched,
      error: res.status === "error" ? res.error : undefined,
    };
  }

  // Insert placeholder row, then scrape
  const link = extracted.platform === "instagram"
    ? `https://www.instagram.com/p/${extracted.id}/`
    : p.data.url;

  const today = new Date().toISOString().split("T")[0];
  const ins = await dbRun(
    `INSERT INTO content_insight
     (account_id, post_date, title, link, shortcode, likes, comments, shares, saves, reposts,
      follows, reach, impression, plays, engagement, engagement_rate, scrape_enabled,
      profile_visit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, datetime('now'), datetime('now'))`,
    [p.data.account_id, today, p.data.title ?? null, link, extracted.id]
  );

  await auditLog(user.id, "add_tracked_url", "content_insight", ins.lastInsertRowid, { url: p.data.url });

  const res = await runScrapeForPost(ins.lastInsertRowid, user.id);
  return {
    ok: true as const,
    post_id: ins.lastInsertRowid,
    duplicate: false,
    matched: res.matched,
    error: res.status === "error" ? res.error : undefined,
  };
}

export async function getScrapeLogs(accountId: number) {
  const user = await requireRole(["admin", "editor", "viewer"]);
  if (!(await hasAccountAccess(user, accountId))) return [];
  return dbAll(
    `SELECT id, scraped_at, status, posts_found, posts_updated, error
     FROM scrape_log WHERE account_id = ?
     ORDER BY scraped_at DESC LIMIT 10`,
    [accountId]
  );
}
