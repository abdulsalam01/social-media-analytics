import { dbAll } from "./db";

export type ComparePeriod = { from: string; to: string; label: string };

export function resolveComparePeriod(range: string, from?: string, to?: string): ComparePeriod {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const shift = (n: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  if (range === "custom" && from && to) return { from, to, label: `${from} → ${to}` };
  if (range === "1d") return { from: todayISO, to: todayISO, label: `Hari ini (${todayISO})` };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return { from: shift(days - 1), to: todayISO, label: `${days} hari terakhir` };
}

export type BrandStats = {
  account_id: number;
  total_content: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  total_reach: number;
  total_plays: number;
  total_impression: number;
  total_engagement: number;
  avg_engagement_rate: number;
  latest_followers: number;
  first_followers: number;
  followers_growth: number;
  new_followers_sum: number;
  visit_sum: number;
  reach_sum: number;
};

/**
 * Compute per-brand stats in constant round-trips regardless of dataset size:
 *   - 1 grouped query on content_insight
 *   - 1 grouped query on profile_insight
 *   - 1 grouped query for latest followers (window function)
 * All three use existing composite indexes.
 */
export async function computeBrandStats(accountIds: number[], from: string, to: string): Promise<Map<number, BrandStats>> {
  const result = new Map<number, BrandStats>();
  if (accountIds.length === 0) return result;
  const ph = accountIds.map(() => "?").join(",");

  const contentRows = await dbAll<Omit<BrandStats, "latest_followers" | "first_followers" | "followers_growth" | "new_followers_sum" | "visit_sum" | "reach_sum">>(
    `SELECT account_id,
       COUNT(*) AS total_content,
       COALESCE(SUM(likes), 0)      AS total_likes,
       COALESCE(SUM(comments), 0)   AS total_comments,
       COALESCE(SUM(shares), 0)     AS total_shares,
       COALESCE(SUM(saves), 0)      AS total_saves,
       COALESCE(SUM(reach), 0)      AS total_reach,
       COALESCE(SUM(plays), 0)      AS total_plays,
       COALESCE(SUM(impression), 0) AS total_impression,
       COALESCE(SUM(engagement), 0) AS total_engagement,
       COALESCE(AVG(engagement_rate), 0) AS avg_engagement_rate
     FROM content_insight
     WHERE account_id IN (${ph}) AND post_date >= ? AND post_date <= ?
     GROUP BY account_id`,
    [...accountIds, from, to]
  );

  const profileRows = await dbAll<{ account_id: number; visit_sum: number; reach_sum: number; new_followers_sum: number }>(
    `SELECT account_id,
       COALESCE(SUM(visit_per_day), 0) AS visit_sum,
       COALESCE(SUM(reach_per_day), 0) AS reach_sum,
       COALESCE(SUM(new_followers), 0) AS new_followers_sum
     FROM profile_insight
     WHERE account_id IN (${ph}) AND date >= ? AND date <= ?
     GROUP BY account_id`,
    [...accountIds, from, to]
  );

  const followerRows = await dbAll<{ account_id: number; latest_followers: number | null; first_followers: number | null }>(
    `WITH ranked AS (
       SELECT account_id, followers, date,
              ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY date DESC) AS rn_last,
              ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY date ASC)  AS rn_first
       FROM profile_insight
       WHERE account_id IN (${ph}) AND date <= ?
     )
     SELECT
       account_id,
       MAX(CASE WHEN rn_last = 1 THEN followers END) AS latest_followers,
       MAX(CASE WHEN rn_first = 1 AND date >= ? THEN followers END) AS first_followers
     FROM ranked
     GROUP BY account_id`,
    [...accountIds, to, from]
  );

  for (const id of accountIds) {
    const c = contentRows.find((r) => r.account_id === id);
    const p = profileRows.find((r) => r.account_id === id);
    const f = followerRows.find((r) => r.account_id === id);
    const latest = f?.latest_followers ?? 0;
    const first = f?.first_followers ?? latest;
    result.set(id, {
      account_id: id,
      total_content: c?.total_content ?? 0,
      total_likes: c?.total_likes ?? 0,
      total_comments: c?.total_comments ?? 0,
      total_shares: c?.total_shares ?? 0,
      total_saves: c?.total_saves ?? 0,
      total_reach: c?.total_reach ?? 0,
      total_plays: c?.total_plays ?? 0,
      total_impression: c?.total_impression ?? 0,
      total_engagement: c?.total_engagement ?? 0,
      avg_engagement_rate: c?.avg_engagement_rate ?? 0,
      latest_followers: latest,
      first_followers: first,
      followers_growth: latest - first,
      new_followers_sum: p?.new_followers_sum ?? 0,
      visit_sum: p?.visit_sum ?? 0,
      reach_sum: p?.reach_sum ?? 0,
    });
  }
  return result;
}

export type DailySeriesRow = { account_id: number; date: string; followers: number; new_followers: number; visit_per_day: number; reach_per_day: number };

export async function getBrandDailySeries(accountIds: number[], from: string, to: string): Promise<DailySeriesRow[]> {
  if (accountIds.length === 0) return [];
  const ph = accountIds.map(() => "?").join(",");
  return dbAll<DailySeriesRow>(
    `SELECT account_id, date, followers, new_followers, visit_per_day, reach_per_day
     FROM profile_insight
     WHERE account_id IN (${ph}) AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [...accountIds, from, to]
  );
}

export type ContentDailyRow = { account_id: number; post_date: string; engagement: number; total_reach_or_plays: number };

export async function getBrandContentDaily(accountIds: number[], from: string, to: string): Promise<ContentDailyRow[]> {
  if (accountIds.length === 0) return [];
  const ph = accountIds.map(() => "?").join(",");
  return dbAll<ContentDailyRow>(
    `SELECT account_id, post_date,
            COALESCE(SUM(engagement), 0) AS engagement,
            COALESCE(SUM(reach) + SUM(plays), 0) AS total_reach_or_plays
     FROM content_insight
     WHERE account_id IN (${ph}) AND post_date >= ? AND post_date <= ?
     GROUP BY account_id, post_date
     ORDER BY post_date ASC`,
    [...accountIds, from, to]
  );
}
