import { isValidISODate, shiftISODate, todayInTimeZone } from "./dates";

export type ComparisonBasis = "total" | "daily";
export type ComparisonRange = { from: string; to: string };

export function rangeDays(range: ComparisonRange): number {
  return Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function precedingRange(range: ComparisonRange): ComparisonRange {
  const to = shiftISODate(range.from, -1);
  return { from: shiftISODate(to, -(rangeDays(range) - 1)), to };
}

export function validComparisonRange(range: ComparisonRange): boolean {
  return isValidISODate(range.from) && isValidISODate(range.to) && range.from <= range.to;
}

export function resolveComparisonRanges(
  input: { from1?: string; to1?: string; from2?: string; to2?: string },
  today = todayInTimeZone()
) {
  const default2 = { from: shiftISODate(today, -29), to: today };
  const notices: string[] = [];
  function resolve(from: string | undefined, to: string | undefined, fallback: ComparisonRange, label: string) {
    const requested = { from: from ?? "", to: to ?? "" };
    if (validComparisonRange(requested)) return requested;
    if (from !== undefined || to !== undefined) {
      notices.push(`${label} tidak valid. Tanggal awal harus sebelum atau sama dengan tanggal akhir; digunakan rentang default yang ditampilkan di filter.`);
    }
    return fallback;
  }
  const range2 = resolve(input.from2, input.to2, default2, "Rentang 2");
  const range1 = resolve(input.from1, input.to1, precedingRange(range2), "Rentang 1");
  const overlapFrom = range1.from > range2.from ? range1.from : range2.from;
  const overlapTo = range1.to < range2.to ? range1.to : range2.to;
  const overlapDays = overlapFrom <= overlapTo ? rangeDays({ from: overlapFrom, to: overlapTo }) : 0;
  return { range1, range2, notices, overlapDays };
}

export type ComparisonAggregate = {
  period: number;
  profile_days: number;
  followers: number | null;
  followers_date: string | null;
  new_followers: number;
  account_visits: number;
  account_reach: number;
  posts: number;
  reach: number;
  impression: number;
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  engagement: number;
};

// Profile/content are aggregated separately: joining raw rows would multiply
// counters. Both date scans use the existing (account_id, date) indexes.
// Only two summary rows travel from Turso, even for large/overlapping ranges.
export const PERIOD_COMPARISON_SQL = `
  WITH periods(period, date_from, date_to) AS (VALUES (1, ?, ?), (2, ?, ?)),
  profile_totals AS (
    SELECT p.period, COUNT(pi.id) AS profile_days,
           COALESCE(SUM(pi.visit_per_day), 0) AS account_visits,
           COALESCE(SUM(pi.reach_per_day), 0) AS account_reach,
           COALESCE(SUM(CASE
             WHEN COALESCE(pi.new_followers, 0) = 0 AND COALESCE(pi.followers_growth, 0) <> 0
               THEN pi.followers_growth
             ELSE COALESCE(pi.new_followers, 0)
           END), 0) AS new_followers
    FROM periods p
    LEFT JOIN profile_insight pi
      ON pi.account_id = ? AND pi.date >= p.date_from AND pi.date <= p.date_to
    GROUP BY p.period
  ),
  content_totals AS (
    SELECT p.period, COUNT(ci.id) AS posts,
           COALESCE(SUM(ci.reach), 0) AS reach,
           COALESCE(SUM(ci.impression), 0) AS impression,
           COALESCE(SUM(ci.plays), 0) AS plays,
           COALESCE(SUM(ci.likes), 0) AS likes,
           COALESCE(SUM(ci.comments), 0) AS comments,
           COALESCE(SUM(ci.shares), 0) AS shares,
           COALESCE(SUM(ci.saves), 0) AS saves,
           COALESCE(SUM(ci.reposts), 0) AS reposts,
           COALESCE(SUM(
             COALESCE(ci.likes, 0) + COALESCE(ci.comments, 0) +
             COALESCE(ci.shares, 0) + COALESCE(ci.saves, 0) + COALESCE(ci.reposts, 0)
           ), 0) AS engagement
    FROM periods p
    LEFT JOIN content_insight ci
      ON ci.account_id = ? AND ci.post_date >= p.date_from AND ci.post_date <= p.date_to
    GROUP BY p.period
  )
  SELECT p.period, pt.profile_days, pt.new_followers, pt.account_visits, pt.account_reach,
         ct.posts, ct.reach, ct.impression, ct.plays, ct.likes, ct.comments,
         ct.shares, ct.saves, ct.reposts, ct.engagement,
         (SELECT pi.followers FROM profile_insight pi
          WHERE pi.account_id = ? AND pi.date <= p.date_to
          ORDER BY pi.date DESC LIMIT 1) AS followers,
         (SELECT pi.date FROM profile_insight pi
          WHERE pi.account_id = ? AND pi.date <= p.date_to
          ORDER BY pi.date DESC LIMIT 1) AS followers_date
  FROM periods p
  JOIN profile_totals pt ON pt.period = p.period
  JOIN content_totals ct ON ct.period = p.period
  ORDER BY p.period
`;

export function periodComparisonArgs(accountId: number, range1: ComparisonRange, range2: ComparisonRange) {
  return [range1.from, range1.to, range2.from, range2.to, accountId, accountId, accountId, accountId];
}

export type ComparisonMetric = {
  key: string;
  label: string;
  kind: "count" | "average" | "rate" | "stock";
  value1: number | null;
  value2: number | null;
  delta: number | null;
  relativeChange: number | null;
};

function ratio(numerator: number, denominator: number | null): number | null {
  return denominator !== null && denominator > 0 ? numerator / denominator : null;
}

export function compareValues(value1: number | null, value2: number | null) {
  if (value1 === null || value2 === null) return { delta: null, relativeChange: null };
  const difference = value2 - value1;
  const delta = Math.abs(difference) < 1e-10 ? 0 : difference;
  return { delta, relativeChange: value1 === 0 ? (value2 === 0 ? 0 : null) : delta / Math.abs(value1) };
}

export function comparisonMetrics(
  data1: ComparisonAggregate,
  data2: ComparisonAggregate,
  days1: number,
  days2: number,
  basis: ComparisonBasis,
  platform: "instagram" | "tiktok"
): ComparisonMetric[] {
  const rows: ComparisonMetric[] = [];
  function add(key: string, label: string, kind: ComparisonMetric["kind"], raw1: number | null, raw2: number | null) {
    const daily = basis === "daily" && kind === "count";
    const value1 = daily && raw1 !== null ? raw1 / days1 : raw1;
    const value2 = daily && raw2 !== null ? raw2 / days2 : raw2;
    rows.push({ key, label, kind, value1, value2, ...compareValues(value1, value2) });
  }
  add("followers", "Followers akhir periode", "stock", data1.followers, data2.followers);
  add("new_followers", "Penambahan follower", "count", data1.new_followers, data2.new_followers);
  add("posts", "Konten dipublikasikan", "count", data1.posts, data2.posts);
  add("account_visits", platform === "tiktok" ? "Video views akun" : "Kunjungan akun", "count", data1.account_visits, data2.account_visits);
  add("account_reach", platform === "tiktok" ? "Profile views akun" : "Reach akun", "count", data1.account_reach, data2.account_reach);
  add("reach", "Reach konten", "count", data1.reach, data2.reach);
  add("impression", "Impression", "count", data1.impression, data2.impression);
  add("plays", "Video plays", "count", data1.plays, data2.plays);
  add("likes", "Likes", "count", data1.likes, data2.likes);
  add("comments", "Komentar", "count", data1.comments, data2.comments);
  add("shares", "Share", "count", data1.shares, data2.shares);
  add("saves", "Save", "count", data1.saves, data2.saves);
  add("reposts", "Repost", "count", data1.reposts, data2.reposts);
  add("engagement", "Total engagement", "count", data1.engagement, data2.engagement);
  add("engagement_per_post", "Engagement per konten", "average", ratio(data1.engagement, data1.posts), ratio(data2.engagement, data2.posts));
  add("er_reach", "ER by reach", "rate", ratio(data1.engagement, data1.reach), ratio(data2.engagement, data2.reach));
  add("er_plays", "ER by plays", "rate", ratio(data1.engagement, data1.plays), ratio(data2.engagement, data2.plays));
  add("er_followers", "Engagement by followers", "rate", ratio(data1.engagement, data1.followers), ratio(data2.engagement, data2.followers));
  return rows;
}

export function formatComparisonValue(value: number | null, metric: Pick<ComparisonMetric, "kind">, basis: ComparisonBasis): string {
  if (value === null) return "—";
  if (metric.kind === "rate") return `${(value * 100).toFixed(2)}%`;
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: metric.kind === "average" || (basis === "daily" && metric.kind === "count") ? 2 : 0,
  }).format(value);
}

export function buildComparisonCsv(account: string, range1: ComparisonRange, range2: ComparisonRange, basis: ComparisonBasis, metrics: ComparisonMetric[]): string {
  function cell(value: string | number | null): string {
    if (value === null) return "";
    if (typeof value === "number") return String(value);
    // User-controlled account names must not become spreadsheet formulas.
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  const rows: Array<Array<string | number | null>> = [
    ["Akun", account],
    ["Rentang 1", range1.from, range1.to, `${rangeDays(range1)} hari`],
    ["Rentang 2", range2.from, range2.to, `${rangeDays(range2)} hari`],
    ["Basis", basis === "daily" ? "Rata-rata per hari kalender" : "Total per rentang"],
    ["Metrik", "Rentang 1", "Rentang 2", "Selisih (2 - 1)", "Perubahan relatif (%)", "Unit nilai / selisih"],
    ...metrics.map((metric) => {
      const scale = metric.kind === "rate" ? 100 : 1;
      const unit = metric.kind === "rate" ? "% / poin persentase" : basis === "daily" && metric.kind === "count" ? "per hari" : metric.kind === "average" ? "per konten" : "total";
      return [metric.label,
        metric.value1 === null ? null : metric.value1 * scale,
        metric.value2 === null ? null : metric.value2 * scale,
        metric.delta === null ? null : metric.delta * scale,
        metric.relativeChange === null ? null : metric.relativeChange * 100,
        unit];
    }),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
