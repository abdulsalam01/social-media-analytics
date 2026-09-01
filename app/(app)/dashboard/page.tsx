import Link from "next/link";
import { Users, Heart, Eye, TrendingUp, MessageCircle, Share2, Bookmark, Activity } from "lucide-react";
import { dbAll } from "@/lib/db";
import { getAccessibleAccounts, resolveActiveAccount } from "@/lib/account-access";
import { requirePageRole } from "@/lib/session";
import { computeRangeSummary, contentEngagementRateSql, contentEngagementSql, growthDelta } from "@/lib/calc";
import { resolveDashboardPeriod, type DashboardRange } from "@/lib/dates";
import { fmtNum, fmtPct, fmtDate } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import PlatformBadge from "@/components/PlatformBadge";
import MetricCard from "@/components/MetricCard";
import AccountPicker from "@/components/AccountPicker";
import DashboardCharts from "./DashboardCharts";
import DashboardFilters from "./DashboardFilters";
import TopPostsList from "./TopPostsList";

export const dynamic = "force-dynamic";

type Range = DashboardRange;
type SortBy = "engagement" | "reach" | "likes" | "comments" | "shares" | "saves" | "rate" | "date";

const SORT_KEYS: SortBy[] = ["engagement", "reach", "likes", "comments", "shares", "saves", "rate", "date"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string; range?: string; from?: string; to?: string; month?: string;
    sortBy?: string; minEng?: string; linkOnly?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requirePageRole(["admin", "editor", "viewer"]);
  const accounts = await getAccessibleAccounts(user);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan performa sosial media kamu.</p>
        </div>
        <EmptyState
          title={user.role === "admin" ? "Yuk, mulai dari sini!" : "Belum ada akun yang ditugaskan"}
          description={user.role === "admin" ? "Daftar akun sosmed pertamamu untuk melihat dashboard analytics." : "Minta admin menugaskan minimal satu akun ke pengguna kamu."}
          ctaHref={user.role === "admin" ? "/accounts/new" : undefined}
          ctaLabel={user.role === "admin" ? "Tambah Akun Pertama" : undefined}
        />
      </div>
    );
  }

  const account = await resolveActiveAccount(accounts, sp.account);
  const isTT = account.platform === "tiktok";

  const range = (["7d", "30d", "90d", "month", "custom"].includes(sp.range || "") ? sp.range : "30d") as Range;
  const period = resolveDashboardPeriod(range, sp.from, sp.to, sp.month);
  const { from: rangeFrom, to: rangeTo, label: rangeLabel } = period;
  const sortBy = (SORT_KEYS.includes(sp.sortBy as SortBy) ? sp.sortBy : "engagement") as SortBy;
  const minEng = Math.max(0, parseInt(sp.minEng || "0") || 0);
  const linkOnly = sp.linkOnly === "1";

  const cur = await computeRangeSummary(account.id, rangeFrom, rangeTo);
  const prev = await computeRangeSummary(account.id, period.prevFrom, period.prevTo);
  const delta = growthDelta(cur, prev);
  const engagementSql = contentEngagementSql();
  const engagementRateSql = contentEngagementRateSql();

  const dailySeries = await dbAll<{
    date: string; followers: number; followers_growth: number; visit_per_day: number; reach_per_day: number;
  }>(
    `SELECT date, followers, followers_growth, visit_per_day, reach_per_day
     FROM profile_insight
     WHERE account_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [account.id, rangeFrom, rangeTo]
  );

  const contentFilters: string[] = ["account_id = ?", "post_date >= ?", "post_date <= ?"];
  const contentArgs: (string | number)[] = [account.id, rangeFrom, rangeTo];
  if (minEng > 0) { contentFilters.push(`${engagementSql} >= ?`); contentArgs.push(minEng); }
  if (linkOnly) { contentFilters.push("link IS NOT NULL AND link <> ''"); }
  const whereClause = contentFilters.join(" AND ");

  const contentSeries = await dbAll<{
    id: number; post_date: string; title: string | null; link: string | null; likes: number; comments: number; shares: number; saves: number; reposts: number;
    reach: number; plays: number; engagement: number; engagement_rate: number;
  }>(
    `SELECT id, post_date, title, link, likes, comments, shares, saves, reposts, reach, plays,
            ${engagementSql} AS engagement,
            ${engagementRateSql} AS engagement_rate
     FROM content_insight
     WHERE ${whereClause}
     ORDER BY post_date ASC`,
    contentArgs
  );

  const sortExpression: Record<SortBy, string> = {
    engagement: engagementSql,
    reach: isTT ? "plays" : "reach",
    likes: "likes",
    comments: "comments",
    shares: "shares",
    saves: "saves",
    rate: engagementRateSql,
    date: "post_date",
  };
  const sortCol = sortExpression[sortBy];
  const topContent = await dbAll<{
    id: number; post_date: string; title: string | null; link: string | null; engagement: number; reach: number; plays: number;
    likes: number; comments: number; shares: number; saves: number; engagement_rate: number;
    impression: number; profile_visit: number;
  }>(
    `SELECT id, post_date, title, link, ${engagementSql} AS engagement, reach, plays, likes, comments, shares, saves,
            ${engagementRateSql} AS engagement_rate, impression, profile_visit
     FROM content_insight
     WHERE ${whereClause}
     ORDER BY ${sortCol} DESC, post_date DESC
     LIMIT 10`,
    contentArgs
  );

  const totalMatchedContent = contentSeries.length;
  const hasData = dailySeries.length > 0 || contentSeries.length > 0 || cur.total_followers > 0;
  const generatedAt = new Date().toISOString();
  const dashboardHref = `/dashboard?${new URLSearchParams({
    account: String(account.id),
    range,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
    ...(sp.month ? { month: sp.month } : {}),
    ...(sortBy !== "engagement" ? { sortBy } : {}),
    ...(minEng > 0 ? { minEng: String(minEng) } : {}),
    ...(linkOnly ? { linkOnly: "1" } : {}),
  }).toString()}`;
  const reportHref = `/report?${new URLSearchParams({
    account: String(account.id),
    ...(range === "month"
      ? { mode: "month", month: sp.month || rangeFrom.slice(0, 7) }
      : { mode: "range", from: rangeFrom, to: rangeTo }),
  }).toString()}`;

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase text-slate-500">SocmedInsight Dashboard</div>
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <div className="text-sm text-slate-600">@{account.handle} • {account.platform.toUpperCase()}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Periode: {rangeLabel}</div>
            <div>Pembanding: {period.prevFrom} — {period.prevTo}</div>
            <div>Dicetak: {fmtDate(generatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Seluruh metrik dan grafik • {rangeLabel}</p>
          <div className="mt-2 flex items-center gap-2">
            <PlatformBadge platform={account.platform} />
            <span className="text-sm font-medium text-slate-700">{account.name}</span>
            <span className="text-sm text-slate-500">@{account.handle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountPicker accounts={accounts} current={account.id} basePath="/dashboard" />
          <Link href={reportHref} className="btn-secondary">
            Lihat Laporan
          </Link>
          {user.role !== "viewer" && <Link href={`/input?account=${account.id}`} className="btn-primary">
            Input Data
          </Link>}
        </div>
      </div>

      <DashboardFilters
        range={range}
        from={sp.from || ""}
        to={sp.to || ""}
        month={sp.month || ""}
        sortBy={sortBy}
        minEng={minEng}
        linkOnly={linkOnly}
        account={account.id}
      />

      {/* Filter summary chip (visible on print + screen) */}
      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap -mt-2">
        <span className="font-medium text-slate-700">Filter aktif:</span>
        <span className="badge-blue">Rentang: {rangeLabel}</span>
        {sortBy !== "engagement" && <span className="badge-blue">Urut: {sortBy}</span>}
        {minEng > 0 && <span className="badge-blue">Min engagement: {fmtNum(minEng)}</span>}
        {linkOnly && <span className="badge-blue">Hanya berlink</span>}
        <span className="text-slate-400">• {fmtNum(totalMatchedContent)} konten cocok</span>
      </div>

      {!hasData ? (
        <EmptyState
          title="Tidak ada data pada rentang ini"
          description="Coba ubah rentang waktu atau kurangi filter, atau input data baru dulu."
          ctaHref={user.role === "viewer" ? undefined : `/input?account=${account.id}`}
          ctaLabel={user.role === "viewer" ? undefined : "Input Data"}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Followers" value={cur.total_followers} delta={delta.total_followers} icon={<Users className="w-5 h-5" />} tone="brand" />
            <MetricCard label="Total Content" value={cur.total_content} delta={delta.total_content} icon={<PenIcon />} tone="pink" />
            <MetricCard label={isTT ? "Video Plays" : "Reach Content"} value={isTT ? cur.total_plays : cur.total_reach_content} delta={isTT ? delta.total_plays : delta.total_reach_content} icon={<Eye className="w-5 h-5" />} tone="amber" />
            <MetricCard label="Engagement" value={cur.total_engagement} delta={delta.total_engagement} icon={<Activity className="w-5 h-5" />} tone="green" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Likes" value={cur.total_likes} icon={<Heart className="w-5 h-5" />} tone="pink" />
            <MetricCard label="Comments" value={cur.total_comments} icon={<MessageCircle className="w-5 h-5" />} tone="brand" />
            <MetricCard label="Shares" value={cur.total_shares} icon={<Share2 className="w-5 h-5" />} tone="green" />
            <MetricCard label="Saves" value={cur.total_saves} icon={<Bookmark className="w-5 h-5" />} tone="amber" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="Engagement Rate by Reach" value={fmtPct(cur.engagement_by_reach)} hint="Total engagement ÷ total reach" icon={<TrendingUp className="w-5 h-5" />} tone="green" />
            <MetricCard label="Engagement Rate by Followers" value={fmtPct(cur.engagement_by_followers)} hint="Total engagement ÷ followers" icon={<TrendingUp className="w-5 h-5" />} tone="brand" />
            {isTT && (
              <MetricCard label="Engagement Rate by Play" value={fmtPct(cur.engagement_by_play)} hint="Total engagement ÷ video plays" icon={<TrendingUp className="w-5 h-5" />} tone="pink" />
            )}
          </div>

          <DashboardCharts
            dailySeries={dailySeries}
            contentSeries={contentSeries}
            topContent={topContent}
            platform={account.platform}
            rangeLabel={rangeLabel}
            sortBy={sortBy}
            backHref={dashboardHref}
          />

          <TopPostsList
            posts={topContent}
            platform={account.platform}
            sortBy={sortBy}
            rangeLabel={rangeLabel}
            backHref={dashboardHref}
          />

          {/* Print-only detailed table */}
          <div className="hidden print:block card">
            <div className="card-hd">
              <div className="font-semibold">Detail Konten dalam Rentang</div>
              <div className="text-xs text-slate-500">{contentSeries.length} baris</div>
            </div>
            <div className="card-bd">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 uppercase">
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">Judul</th>
                    <th className="py-2 pr-3">Link</th>
                    <th className="py-2 pr-3 text-right">Like</th>
                    <th className="py-2 pr-3 text-right">Comment</th>
                    <th className="py-2 pr-3 text-right">Share</th>
                    <th className="py-2 pr-3 text-right">Save</th>
                    <th className="py-2 pr-3 text-right">{isTT ? "Plays" : "Reach"}</th>
                    <th className="py-2 pr-3 text-right">Engagement</th>
                    <th className="py-2 pr-3 text-right">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {contentSeries.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3">{fmtDate(p.post_date)}</td>
                      <td className="py-1.5 pr-3 max-w-[200px] truncate">{p.title || "—"}</td>
                      <td className="py-1.5 pr-3 max-w-[180px] truncate">{p.link || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(p.likes)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(p.comments)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(p.shares)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(p.saves)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(isTT ? p.plays : p.reach)}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold">{fmtNum(p.engagement)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtPct(p.engagement_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
