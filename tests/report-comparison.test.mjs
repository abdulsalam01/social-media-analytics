import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import {
  buildComparisonCsv, compareValues, comparisonMetrics, formatComparisonValue,
  periodComparisonArgs, PERIOD_COMPARISON_SQL, precedingRange, rangeDays,
  resolveComparisonRanges, validComparisonRange,
} from "../lib/report-comparison.ts";

// Deliberately bypass app/lib/db: no .env, bootstrap, migrations, or remote DB.
const client = createClient({ url: "file::memory:", intMode: "number" });
const range1 = { from: "2026-01-01", to: "2026-01-02" };
const range2 = { from: "2026-01-03", to: "2026-01-04" };

before(async () => {
  await client.executeMultiple(`
    CREATE TABLE profile_insight (
      id INTEGER PRIMARY KEY, account_id INTEGER, date TEXT,
      visit_per_day INTEGER, reach_per_day INTEGER, followers INTEGER,
      followers_growth INTEGER, new_followers INTEGER
    );
    CREATE TABLE content_insight (
      id INTEGER PRIMARY KEY, account_id INTEGER, post_date TEXT,
      reach INTEGER, impression INTEGER, plays INTEGER, likes INTEGER,
      comments INTEGER, shares INTEGER, saves INTEGER, reposts INTEGER,
      engagement INTEGER, engagement_rate REAL
    );
    CREATE INDEX idx_test_profile_date ON profile_insight(account_id, date);
    CREATE INDEX idx_test_content_date ON content_insight(account_id, post_date);
    INSERT INTO profile_insight VALUES
      (1, 1, '2026-01-01', 10, 20, 100, 5, 0),
      (2, 1, '2026-01-02', 20, 30, 105, 5, 5),
      (3, 1, '2026-01-03', 30, 40, 110, -2, -2),
      (4, 1, '2026-01-10', 999, 999, 999, 889, 889),
      (5, 2, '2026-01-02', 9999, 9999, 9999, 9999, 9999);
    INSERT INTO content_insight VALUES
      (1, 1, '2026-01-01', 100, 200, 0, 10, 2, 3, 1, 1, 99999, 3400),
      (2, 1, '2026-01-02', 200, 300, 50, 20, 0, 0, 0, 0, 99999, 3400),
      (3, 1, '2026-01-03', 300, 400, 100, 50, 10, 5, 0, 0, 99999, 3400),
      (4, 1, '2026-01-04', 0, 0, 0, 0, 0, 0, 0, 0, 99999, 3400),
      (5, 1, '2026-01-05', 9999, 9999, 9999, 9999, 0, 0, 0, 0, 99999, 3400),
      (6, 2, '2026-01-03', 9999, 9999, 9999, 9999, 0, 0, 0, 0, 99999, 3400);
  `);
});
after(() => client.close());

async function summaries(first = range1, second = range2) {
  const result = await client.execute({ sql: PERIOD_COMPARISON_SQL, args: periodComparisonArgs(1, first, second) });
  return result.rows;
}

test("inclusive dates, leap year, adjacent defaults, and year rollover", () => {
  assert.equal(rangeDays({ from: "2024-02-28", to: "2024-03-01" }), 3);
  assert.equal(rangeDays({ from: "2026-01-01", to: "2026-01-01" }), 1);
  assert.deepEqual(precedingRange(range1), { from: "2025-12-30", to: "2025-12-31" });
  const defaults = resolveComparisonRanges({}, "2026-01-10");
  assert.equal(rangeDays(defaults.range1), 30);
  assert.equal(rangeDays(defaults.range2), 30);
  assert.equal(defaults.range2.to, "2026-01-10");
  assert.equal(defaults.overlapDays, 0);
  assert.deepEqual(defaults.notices, []);
});

test("invalid, reversed, and partial URL ranges are explicitly reported", () => {
  assert.equal(validComparisonRange({ from: "2026-02-29", to: "2026-03-01" }), false);
  assert.equal(validComparisonRange({ from: "2026-03-03", to: "2026-03-01" }), false);
  const resolved = resolveComparisonRanges({ from1: "2026-03-03", to1: "2026-03-01", from2: "2026-02-01" }, "2026-03-01");
  assert.equal(resolved.notices.length, 2);
  assert.ok(validComparisonRange(resolved.range1));
  assert.ok(validComparisonRange(resolved.range2));
});

test("single query returns only two rows, separates raw aggregates, and excludes other accounts", async () => {
  const [first, second] = await summaries();
  assert.equal(first.period, 1);
  assert.equal(second.period, 2);
  assert.equal(first.profile_days, 2);
  assert.equal(first.posts, 2);
  assert.equal(first.account_visits, 30); // not doubled by two content rows
  assert.equal(first.new_followers, 10); // legacy growth fallback remains supported
  assert.equal(first.engagement, 37); // raw counters, not bogus cached engagement/ER
  assert.equal(first.reach, 300);
  assert.equal(first.followers, 105); // final stock, never SUM(followers)
  assert.equal(first.followers_date, "2026-01-02");
  assert.equal(second.engagement, 65);
  assert.equal(second.new_followers, -2); // signed follower loss retained
  assert.equal(second.followers, 110); // never uses Jan 10 future snapshot
});

test("overlapping periods count their shared date independently without multiplying totals", async () => {
  const overlap = { from: "2026-01-02", to: "2026-01-03" };
  const resolved = resolveComparisonRanges({ from1: overlap.from, to1: overlap.to, from2: range2.from, to2: range2.to });
  assert.equal(resolved.overlapDays, 1);
  const [first, second] = await summaries(overlap, range2);
  assert.equal(first.engagement, 85);
  assert.equal(second.engagement, 65);
  const [single] = await summaries({ from: "2026-01-03", to: "2026-01-03" });
  assert.equal(single.posts, 1);
  assert.equal(single.engagement, 65);
});

test("empty data keeps totals zero, unknown followers/ER null, and previous snapshots explicit", async () => {
  const [empty, historical] = await summaries(
    { from: "2025-12-01", to: "2025-12-31" },
    { from: "2026-01-06", to: "2026-01-07" }
  );
  assert.equal(empty.posts, 0);
  assert.equal(empty.profile_days, 0);
  assert.equal(empty.followers, null);
  assert.equal(historical.followers, 110);
  assert.equal(historical.followers_date, "2026-01-03");
  const metrics = comparisonMetrics(empty, historical, 31, 2, "total", "instagram");
  assert.equal(metrics.find((metric) => metric.key === "er_reach").value1, null);
  assert.equal(metrics.find((metric) => metric.key === "engagement_per_post").value2, null);
  assert.equal(formatComparisonValue(null, { kind: "rate" }, "total"), "—");
});

test("daily normalization divides additive totals, never follower stocks, weighted rates, or per-post ratios", async () => {
  const [first, second] = await summaries();
  const metrics = comparisonMetrics(first, second, 2, 4, "daily", "instagram");
  const engagement = metrics.find((metric) => metric.key === "engagement");
  assert.equal(engagement.value1, 18.5);
  assert.equal(engagement.value2, 16.25);
  assert.equal(engagement.delta, -2.25);
  assert.equal(metrics.find((metric) => metric.key === "followers").value1, 105);
  assert.equal(metrics.find((metric) => metric.key === "er_reach").value1, 37 / 300);
  assert.equal(metrics.find((metric) => metric.key === "engagement_per_post").value1, 18.5);
});

test("relative change handles zero/null/negative baselines without Infinity or NaN", () => {
  assert.deepEqual(compareValues(0, 34), { delta: 34, relativeChange: null });
  assert.deepEqual(compareValues(0, 0), { delta: 0, relativeChange: 0 });
  assert.deepEqual(compareValues(null, 34), { delta: null, relativeChange: null });
  assert.deepEqual(compareValues(-5, -2), { delta: 3, relativeChange: 0.6 });
  assert.deepEqual(compareValues(100, 150), { delta: 50, relativeChange: 0.5 });
});

test("query plan uses existing account/date indexes for both range scans", async () => {
  const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${PERIOD_COMPARISON_SQL}`, args: periodComparisonArgs(1, range1, range2) });
  const details = plan.rows.map((row) => String(row.detail)).join("\n");
  assert.match(details, /SEARCH pi USING INDEX idx_test_profile_date/);
  assert.match(details, /SEARCH ci USING INDEX idx_test_content_date/);
  assert.doesNotMatch(details, /SCAN (?:pi|ci)\b/);
});

test("CSV preserves comparison dates/units and escapes user-controlled spreadsheet formulas", async () => {
  const [first, second] = await summaries();
  const metrics = comparisonMetrics(first, second, 2, 2, "total", "instagram");
  const csv = buildComparisonCsv('=HYPERLINK("evil")', range1, range2, "total", metrics);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /2026-01-01/);
  assert.match(csv, /poin persentase/);
  assert.doesNotMatch(csv, /Infinity|NaN/);
});

test("10,000 content rows still return only two compact aggregate rows", async (t) => {
  await client.execute(`
    WITH RECURSIVE sequence(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM sequence WHERE n < 10000)
    INSERT INTO content_insight(account_id, post_date, reach, impression, plays, likes, comments, shares, saves, reposts)
    SELECT 3, CASE WHEN n <= 5000 THEN '2026-01-01' ELSE '2026-01-03' END,
           100, 100, 0, 1, 0, 0, 0, 0 FROM sequence
  `);
  const started = performance.now();
  const result = await client.execute({ sql: PERIOD_COMPARISON_SQL, args: periodComparisonArgs(3, range1, range2) });
  t.diagnostic(`Local indexed aggregate query: ${(performance.now() - started).toFixed(2)} ms (not a production latency guarantee)`);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].posts, 5000);
  assert.equal(result.rows[1].posts, 5000);
  assert.equal(result.rows[0].engagement, 5000);
  assert.ok(JSON.stringify(result.rows).length < 2000);
});
