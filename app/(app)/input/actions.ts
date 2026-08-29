"use server";
import { z } from "zod";
import { dbGet, dbRun, dbTx, txRun } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";
import { getAccountIdForContent, getAccountIdForProfile, hasAccountAccess } from "@/lib/account-access";

const ProfileSchema = z.object({
  account_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal salah"),
  visit_per_day: z.number().int().min(0),
  reach_per_day: z.number().int().min(0),
  new_followers: z.number().int().default(0), // signed: + adds, - subtracts
});

/**
 * Save daily profile insight. `followers` (total) is auto-derived from
 * previous day's followers + this day's delta. User only inputs the delta.
 */
export async function saveProfileInsight(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const p = ProfileSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Data tidak valid" };
  const { account_id, date, visit_per_day, reach_per_day, new_followers } = p.data;
  if (!(await hasAccountAccess(user, account_id))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };

  const prev = await dbGet<{ followers: number }>(
    "SELECT followers FROM profile_insight WHERE account_id = ? AND date < ? ORDER BY date DESC LIMIT 1",
    [account_id, date]
  );
  const prevFollowers = prev?.followers ?? 0;
  const followers = Math.max(0, prevFollowers + new_followers);
  const growth = new_followers;

  await dbRun(
    `INSERT INTO profile_insight (account_id, date, visit_per_day, reach_per_day, followers, followers_growth, new_followers, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(account_id, date) DO UPDATE SET
       visit_per_day = excluded.visit_per_day,
       reach_per_day = excluded.reach_per_day,
       followers = excluded.followers,
       followers_growth = excluded.followers_growth,
       new_followers = excluded.new_followers,
       updated_at = datetime('now')`,
    [account_id, date, visit_per_day, reach_per_day, followers, growth, new_followers]
  );

  await auditLog(user.id, "upsert", "profile_insight", account_id, { date, delta: new_followers });
  return { ok: true as const };
}

const ContentRowSchema = z.object({
  account_id: z.number().int().positive(),
  post_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().max(200).nullable().optional().transform((v) => (v && v.length ? v : null)),
  link: z.string().nullable(),
  profile_visit: z.number().int().min(0),
  likes: z.number().int().min(0),
  comments: z.number().int().min(0),
  shares: z.number().int().min(0),
  saves: z.number().int().min(0),
  reposts: z.number().int().min(0).default(0),
  follows: z.number().int().min(0),
  reach: z.number().int().min(0),
  impression: z.number().int().min(0),
  plays: z.number().int().min(0),
});

export async function saveContentRows(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const parsed = z.array(ContentRowSchema).min(1).max(200).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Data konten tidak valid" };
  const accountIds = [...new Set(parsed.data.map((row) => row.account_id))];
  for (const accountId of accountIds) {
    if (!(await hasAccountAccess(user, accountId))) return { ok: false as const, error: "Kamu tidak punya akses ke salah satu akun" };
  }

  await dbTx(async (tx) => {
    for (const r of parsed.data) {
      const engagement = r.likes + r.comments + r.shares + r.saves + r.reposts;
      const denom = r.reach > 0 ? r.reach : r.plays;
      const rate = denom > 0 ? engagement / denom : 0;
      await txRun(tx,
        `INSERT INTO content_insight
         (account_id, post_date, title, link, profile_visit, likes, comments, shares, saves, reposts, follows, reach, impression, plays, engagement, engagement_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [r.account_id, r.post_date, r.title ?? null, r.link, r.profile_visit, r.likes, r.comments,
         r.shares, r.saves, r.reposts, r.follows, r.reach, r.impression, r.plays, engagement, rate]
      );
    }
  });

  await auditLog(user.id, "bulk_insert", "content_insight", parsed.data[0].account_id, { count: parsed.data.length });
  return { ok: true as const, count: parsed.data.length };
}

const ProfileUpdateSchema = ProfileSchema.extend({ id: z.number().int().positive() });

export async function updateProfileInsight(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const p = ProfileUpdateSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Data tidak valid" };
  const { id, account_id, date, visit_per_day, reach_per_day, new_followers } = p.data;
  if (!(await hasAccountAccess(user, account_id))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };

  const prev = await dbGet<{ followers: number }>(
    "SELECT followers FROM profile_insight WHERE account_id = ? AND date < ? AND id != ? ORDER BY date DESC LIMIT 1",
    [account_id, date, id]
  );
  const prevFollowers = prev?.followers ?? 0;
  const followers = Math.max(0, prevFollowers + new_followers);
  const growth = new_followers;

  const res = await dbRun(
    `UPDATE profile_insight
     SET date = ?, visit_per_day = ?, reach_per_day = ?, followers = ?, followers_growth = ?, new_followers = ?, updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`,
    [date, visit_per_day, reach_per_day, followers, growth, new_followers, id, account_id]
  );
  if (res.changes === 0) return { ok: false as const, error: "Data tidak ditemukan" };
  await auditLog(user.id, "update", "profile_insight", id, { date });
  return { ok: true as const };
}

export async function deleteProfileInsight(id: number) {
  const user = await requireRole(["admin", "editor"]);
  const accountId = await getAccountIdForProfile(id);
  if (!accountId || !(await hasAccountAccess(user, accountId))) return { ok: false as const, error: "Data tidak ditemukan atau akses ditolak" };
  const res = await dbRun("DELETE FROM profile_insight WHERE id = ?", [id]);
  if (res.changes === 0) return { ok: false as const, error: "Data tidak ditemukan" };
  await auditLog(user.id, "delete", "profile_insight", id);
  return { ok: true as const };
}

const ContentUpdateSchema = ContentRowSchema.extend({ id: z.number().int().positive() });

export async function updateContentInsight(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const p = ContentUpdateSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Data konten tidak valid" };
  const r = p.data;
  if (!(await hasAccountAccess(user, r.account_id))) return { ok: false as const, error: "Kamu tidak punya akses ke akun ini" };
  const engagement = r.likes + r.comments + r.shares + r.saves + r.reposts;
  const denom = r.reach > 0 ? r.reach : r.plays;
  const rate = denom > 0 ? engagement / denom : 0;
  const res = await dbRun(
    `UPDATE content_insight SET
       post_date = ?, title = ?, link = ?, profile_visit = ?, likes = ?, comments = ?,
       shares = ?, saves = ?, reposts = ?, follows = ?, reach = ?, impression = ?, plays = ?,
       engagement = ?, engagement_rate = ?, updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`,
    [r.post_date, r.title ?? null, r.link, r.profile_visit, r.likes, r.comments,
     r.shares, r.saves, r.reposts, r.follows, r.reach, r.impression, r.plays,
     engagement, rate, r.id, r.account_id]
  );
  if (res.changes === 0) return { ok: false as const, error: "Data tidak ditemukan" };
  await auditLog(user.id, "update", "content_insight", r.id, { post_date: r.post_date });
  return { ok: true as const };
}

export async function deleteContentInsight(id: number) {
  const user = await requireRole(["admin", "editor"]);
  const accountId = await getAccountIdForContent(id);
  if (!accountId || !(await hasAccountAccess(user, accountId))) return { ok: false as const, error: "Data tidak ditemukan atau akses ditolak" };
  const res = await dbRun("DELETE FROM content_insight WHERE id = ?", [id]);
  if (res.changes === 0) return { ok: false as const, error: "Data tidak ditemukan" };
  await auditLog(user.id, "delete", "content_insight", id);
  return { ok: true as const };
}
