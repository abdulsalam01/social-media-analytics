import { dbAll, Account } from "@/lib/db";
import { computeRangeSummary, growthDelta } from "@/lib/calc";
import { weekStartOf, weekLabel, monthRange, currentMonth } from "@/lib/dates";
import Link from "next/link";
import { fmtNum, fmtPct, fmtDate } from "@/lib/utils";
import PlatformBadge from "@/components/PlatformBadge";
import EmptyState from "@/components/EmptyState";
import AccountPicker from "@/components/AccountPicker";
import PrintButton from "./PrintButton";
import PeriodPicker from "./PeriodPicker";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

type Mode = "day" | "week" | "month" | "range";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function validISO(s: string | undefined | null): s is string {
  if (!s || !ISO_RE.test(s)) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return !Number.isNaN(t);
}

function resolvePeriod(mode: Mode, week: string, month: string, from: string, to: string): { from: string; to: string; label: string; prevFrom: string; prevTo: string } {
  const shift = (iso: string, days: number) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (mode === "day") {
    const day = validISO(from) ? from : new Date().toISOString().slice(0, 10);
    return { from: day, to: day, label: `Harian: ${day}`, prevFrom: shift(day, -1), prevTo: shift(day, -1) };
  }
  if (mode === "month") {
    const key = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
    const m = monthRange(key);
    const [y, mm] = key.split("-").map((x) => parseInt(x));
    const prevM = new Date(Date.UTC(y, mm - 2, 1));
    const prevKey = `${prevM.getUTCFullYear()}-${String(prevM.getUTCMonth() + 1).padStart(2, "0")}`;
    const prev = monthRange(prevKey);
    return { from: m.from, to: m.to, label: m.label, prevFrom: prev.from, prevTo: prev.to };
  }
  if (mode === "range") {
    // Fallback to last 30 days if from/to missing or malformed
    if (!validISO(from) || !validISO(to) || from > to) {
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const from30 = shift(todayISO, -29);
      return {
        from: from30, to: todayISO,
        label: `${from30} → ${todayISO} (default 30 hari)`,
        prevFrom: shift(from30, -30), prevTo: shift(from30, -1),
      };
    }
    const days = Math.max(1, Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1);
    return {
      from, to, label: `${from} → ${to}`,
      prevFrom: shift(from, -days), prevTo: shift(from, -1),
    };
  }
  // week
  const w = validISO(week) ? week : (() => {
    const d = new Date().toISOString().slice(0, 10);
    return weekStartOf(d);
  })();
  const end = shift(w, 6);
  return { from: w, to: end, label: `Minggu: ${weekLabel(w)}`, prevFrom: shift(w, -7), prevTo: shift(w, -1) };
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; mode?: string; week?: string; month?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const accounts = await dbAll<Account>("SELECT * FROM accounts ORDER BY name ASC");
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Belum ada akun"
        description="Tambah akun sosmed dulu."
        ctaHref="/accounts/new"
        ctaLabel="Tambah Akun"
      />
    );
  }

  const accountId = sp.account ? parseInt(sp.account) : accounts[0].id;
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const mode = (["day", "week", "month", "range"].includes(sp.mode || "") ? sp.mode : "week") as Mode;
  const week = sp.week || weekStartOf(new Date().toISOString().slice(0, 10));
  const month = sp.month || currentMonth();
  const period = resolvePeriod(mode, week, month, sp.from || "", sp.to || "");

  const cur = await computeRangeSummary(account.id, period.from, period.to);
  const prev = await computeRangeSummary(account.id, period.prevFrom, period.prevTo);
  const delta = growthDelta(cur, prev);
  const isTT = account.platform === "tiktok";

  const posts = await dbAll<{
    id: number; post_date: string; title: string | null; link: string | null; likes: number; comments: number; shares: number; saves: number;
    reach: number; plays: number; impression: number; engagement: number; engagement_rate: number;
  }>(
    `SELECT id, post_date, title, link, likes, comments, shares, saves, reach, plays, impression, engagement, engagement_rate
     FROM content_insight
     WHERE account_id = ? AND post_date >= ? AND post_date <= ?
     ORDER BY post_date ASC, id ASC`,
    [account.id, period.from, period.to]
  );

  const growthLabelPrev = mode === "day" ? "vs Hari Sebelumnya" : mode === "week" ? "vs Minggu Lalu" : mode === "month" ? "vs Bulan Lalu" : "vs Rentang Sebelumnya";

  const rows: Array<{ label: string; cur: number; delta: number | undefined; isPct?: boolean }> = [
    { label: "Total Followers", cur: cur.total_followers, delta: delta.total_followers },
    { label: "Penambahan Follower", cur: cur.total_new_followers, delta: delta.total_new_followers },
    { label: "Total Content", cur: cur.total_content, delta: delta.total_content },
    ...(isTT
      ? [
          { label: "Total Video Views Account", cur: cur.total_visit_account, delta: delta.total_visit_account },
          { label: "Total Profile Views Account", cur: cur.total_reach_account, delta: delta.total_reach_account },
          { label: "Total Video Plays", cur: cur.total_plays, delta: delta.total_plays },
        ]
      : [
          { label: "Total Visit Account", cur: cur.total_visit_account, delta: delta.total_visit_account },
          { label: "Total Reach Account", cur: cur.total_reach_account, delta: delta.total_reach_account },
          { label: "Total Reach Content", cur: cur.total_reach_content, delta: delta.total_reach_content },
        ]),
    { label: "Total Likes", cur: cur.total_likes, delta: delta.total_likes },
    { label: "Total Comment", cur: cur.total_comments, delta: delta.total_comments },
    { label: "Total Share", cur: cur.total_shares, delta: delta.total_shares },
    { label: "Total Save", cur: cur.total_saves, delta: delta.total_saves },
    { label: "Total Engagement", cur: cur.total_engagement, delta: delta.total_engagement },
    { label: "Engagement by Reach", cur: cur.engagement_by_reach, delta: delta.engagement_by_reach, isPct: true },
    { label: "Engagement by Followers", cur: cur.engagement_by_followers, delta: delta.engagement_by_followers, isPct: true },
    ...(isTT ? [{ label: "Engagement by Play", cur: cur.engagement_by_play, delta: delta.engagement_by_play, isPct: true }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="no-print flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan</h1>
          <p className="text-sm text-slate-500">Ringkasan performa mingguan / bulanan / rentang custom.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountPicker accounts={accounts} current={account.id} basePath="/report" />
          <PeriodPicker
            mode={mode}
            week={week}
            month={month}
            from={sp.from || ""}
            to={sp.to || ""}
            account={account.id}
          />
          <PrintButton />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-brand-600 to-brand-400 text-white">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Laporan Analytics</div>
              <h2 className="text-2xl font-bold mt-1">{account.name}</h2>
              <div className="text-sm opacity-90 mt-1">@{account.handle} • {period.label}</div>
              <div className="text-xs opacity-75 mt-0.5">{period.from} — {period.to}</div>
            </div>
            <PlatformBadge platform={account.platform} size="md" />
          </div>
          <div className="text-xs mt-4 opacity-80">Digenerate: {fmtDate(new Date().toISOString())}</div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Ringkasan Periode</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4 text-right">Achievement</th>
                  <th className="py-2 pr-4 text-right">{growthLabelPrev}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 text-slate-700">{r.label}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-slate-900">
                      {r.isPct ? fmtPct(r.cur) : fmtNum(r.cur)}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <GrowthPill value={r.delta} isPct={r.isPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {posts.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Detail Konten ({posts.length})</h3>
            <div className="overflow-x-auto">
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
                  {posts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{fmtDate(p.post_date)}</td>
                      <td className="py-2 pr-3 max-w-[240px]">
                        <Link
                          href={`/content/${p.id}?from=${encodeURIComponent(`/report?account=${account.id}&mode=${mode}${sp.week ? `&week=${sp.week}` : ""}${sp.month ? `&month=${sp.month}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`)}`}
                          className="hover:underline"
                        >
                          {p.title ? (
                            <span className="font-medium text-brand-700 truncate block" title={p.title}>{p.title}</span>
                          ) : (
                            <span className="text-slate-400 italic">Lihat detail</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 max-w-[120px] truncate">
                        {p.link ? (
                          <a href={p.link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1">
                            Buka <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtNum(p.likes)}</td>
                      <td className="py-2 pr-3 text-right">{fmtNum(p.comments)}</td>
                      <td className="py-2 pr-3 text-right">{fmtNum(p.shares)}</td>
                      <td className="py-2 pr-3 text-right">{fmtNum(p.saves)}</td>
                      <td className="py-2 pr-3 text-right">{fmtNum(isTT ? p.plays : p.reach)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{fmtNum(p.engagement)}</td>
                      <td className="py-2 pr-3 text-right">{fmtPct(p.engagement_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthPill({ value, isPct }: { value: number | undefined; isPct?: boolean }) {
  if (value === undefined || value === 0) {
    return (
      <span className="badge-slate">
        <Minus className="w-3 h-3" /> —
      </span>
    );
  }
  const positive = value > 0;
  const label = isPct ? fmtPct(Math.abs(value)) : fmtNum(Math.abs(value));
  return positive ? (
    <span className="badge-green">
      <TrendingUp className="w-3 h-3" /> +{label}
    </span>
  ) : (
    <span className="badge-red">
      <TrendingDown className="w-3 h-3" /> −{label}
    </span>
  );
}
