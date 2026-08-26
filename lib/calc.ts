import { dbGet } from "./db";
export { weekStartOf, weekLabel } from "./dates";

export type WeeklySummary = {
  week_start: string;
  total_followers: number;
  total_new_followers: number;
  total_content: number;
  total_visit_account: number;
  total_reach_account: number;
  total_reach_content: number;
  total_impression: number;
  total_plays: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  total_engagement: number;
  engagement_by_reach: number;
  engagement_by_followers: number;
  engagement_by_play: number;
};

const emptySummary = (week: string): WeeklySummary => ({
  week_start: week,
  total_followers: 0,
  total_new_followers: 0,
  total_content: 0,
  total_visit_account: 0,
  total_reach_account: 0,
  total_reach_content: 0,
  total_impression: 0,
  total_plays: 0,
  total_likes: 0,
  total_comments: 0,
  total_shares: 0,
  total_saves: 0,
  total_engagement: 0,
  engagement_by_reach: 0,
  engagement_by_followers: 0,
  engagement_by_play: 0,
});

/**
 * Aggregated summary for any date range. All queries are indexed grouped
 * aggregates — O(1) round-trip regardless of dataset size.
 */
export async function computeRangeSummary(accountId: number, from: string, to: string): Promise<WeeklySummary> {
  const profileAgg = await dbGet<{ visit: number; reach: number; new_followers: number }>(
    `SELECT
       COALESCE(SUM(visit_per_day), 0) AS visit,
       COALESCE(SUM(reach_per_day), 0) AS reach,
       COALESCE(SUM(new_followers), 0) AS new_followers
     FROM profile_insight
     WHERE account_id = ? AND date >= ? AND date <= ?`,
    [accountId, from, to]
  );

  const lastFollowers = await dbGet<{ followers: number }>(
    `SELECT followers FROM profile_insight
     WHERE account_id = ? AND date <= ?
     ORDER BY date DESC LIMIT 1`,
    [accountId, to]
  );

  const contentAgg = await dbGet<{
    total_content: number; reach: number; impression: number; plays: number;
    likes: number; comments: number; shares: number; saves: number; engagement: number;
  }>(
    `SELECT
       COUNT(*)                     AS total_content,
       COALESCE(SUM(reach), 0)      AS reach,
       COALESCE(SUM(impression), 0) AS impression,
       COALESCE(SUM(plays), 0)      AS plays,
       COALESCE(SUM(likes), 0)      AS likes,
       COALESCE(SUM(comments), 0)   AS comments,
       COALESCE(SUM(shares), 0)     AS shares,
       COALESCE(SUM(saves), 0)      AS saves,
       COALESCE(SUM(engagement), 0) AS engagement
     FROM content_insight
     WHERE account_id = ? AND post_date >= ? AND post_date <= ?`,
    [accountId, from, to]
  );

  const followers = lastFollowers?.followers ?? 0;
  const engagement = contentAgg?.engagement ?? 0;
  const reach = contentAgg?.reach ?? 0;
  const plays = contentAgg?.plays ?? 0;

  return {
    week_start: from,
    total_followers: followers,
    total_new_followers: profileAgg?.new_followers ?? 0,
    total_content: contentAgg?.total_content ?? 0,
    total_visit_account: profileAgg?.visit ?? 0,
    total_reach_account: profileAgg?.reach ?? 0,
    total_reach_content: reach,
    total_impression: contentAgg?.impression ?? 0,
    total_plays: plays,
    total_likes: contentAgg?.likes ?? 0,
    total_comments: contentAgg?.comments ?? 0,
    total_shares: contentAgg?.shares ?? 0,
    total_saves: contentAgg?.saves ?? 0,
    total_engagement: engagement,
    engagement_by_reach: reach > 0 ? engagement / reach : 0,
    engagement_by_followers: followers > 0 ? engagement / followers : 0,
    engagement_by_play: plays > 0 ? engagement / plays : 0,
  };
}

export async function computeWeeklySummary(accountId: number, weekStart: string): Promise<WeeklySummary> {
  const weekEnd = new Date(weekStart + "T00:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  return computeRangeSummary(accountId, weekStart, weekEnd.toISOString().slice(0, 10));
}

export function growthDelta(cur: WeeklySummary, prev: WeeklySummary | null): Partial<WeeklySummary> {
  if (!prev) return {};
  const keys = Object.keys(cur) as (keyof WeeklySummary)[];
  const out: Record<string, number> = {};
  for (const k of keys) {
    if (k === "week_start") continue;
    out[k] = (cur[k] as number) - (prev[k] as number);
  }
  return out as Partial<WeeklySummary>;
}

export { emptySummary };
