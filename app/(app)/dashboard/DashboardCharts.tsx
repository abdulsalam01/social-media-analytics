"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, AreaChart, Area, Cell,
} from "recharts";
import { fmtNum } from "@/lib/utils";
import type { Platform } from "@/lib/db";
import { format } from "date-fns";
import { ExternalLink, MousePointerClick } from "lucide-react";

type Daily = { date: string; followers: number; followers_growth: number; visit_per_day: number; reach_per_day: number };
type Content = {
  id: number; post_date: string; title: string | null; link: string | null;
  likes: number; comments: number; shares: number; saves: number;
  reach: number; plays: number; engagement: number; engagement_rate: number;
};
type TopPost = {
  id: number; post_date: string; title: string | null; link: string | null;
  engagement: number; reach: number; plays: number;
  likes: number; comments: number; shares: number; saves: number; engagement_rate: number;
};

const KIND_COLORS = { Like: "#E1306C", Comment: "#3757fa", Share: "#10b981", Save: "#f59e0b" };
const KEY_COLORS: Record<string, string> = { likes: "#E1306C", comments: "#3757fa", shares: "#10b981", saves: "#f59e0b" };

function normalizeLink(link: string | null, platform: Platform): string | null {
  if (!link) return null;
  const t = link.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (platform === "instagram" && !t.includes(" ")) return `https://www.instagram.com/p/${t.replace(/^\/+/, "")}`;
  if (platform === "tiktok" && !t.includes(" ")) return `https://www.tiktok.com/${t.replace(/^\/+/, "")}`;
  return t;
}

function shortLabel(p: { title: string | null; post_date: string }, i: number) {
  if (p.title && p.title.length > 0) {
    return p.title.length > 22 ? p.title.slice(0, 22) + "…" : p.title;
  }
  return `#${i + 1} · ${format(new Date(p.post_date), "dd MMM")}`;
}

export default function DashboardCharts({
  dailySeries,
  contentSeries,
  topContent,
  platform,
  rangeLabel = "30 hari terakhir",
  sortBy = "engagement",
  backHref = "",
}: {
  dailySeries: Daily[];
  contentSeries: Content[];
  topContent: TopPost[];
  platform: Platform;
  rangeLabel?: string;
  sortBy?: string;
  backHref?: string;
}) {
  const isTT = platform === "tiktok";
  const router = useRouter();
  const [breakdownFilter, setBreakdownFilter] = useState<null | "Like" | "Comment" | "Share" | "Save">(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  function gotoDetail(id: number | undefined) {
    if (!id) return;
    const qs = backHref ? `?from=${encodeURIComponent(backHref)}` : "";
    router.push(`/content/${id}${qs}`);
  }

  const sortLabel: Record<string, string> = {
    engagement: "Engagement",
    reach: isTT ? "Plays" : "Reach",
    likes: "Like", comments: "Comment", shares: "Share", saves: "Save",
    rate: "Engagement Rate", date: "Tanggal",
  };

  const followersData = dailySeries.map((d) => ({
    date: format(new Date(d.date), "dd MMM"),
    Followers: d.followers,
  }));

  const reachData = dailySeries.map((d) => ({
    date: format(new Date(d.date), "dd MMM"),
    Visit: d.visit_per_day,
    Reach: d.reach_per_day,
  }));

  const engagementBreakdown = contentSeries.reduce(
    (acc, c) => ({
      Like: acc.Like + c.likes,
      Comment: acc.Comment + c.comments,
      Share: acc.Share + c.shares,
      Save: acc.Save + c.saves,
    }),
    { Like: 0, Comment: 0, Share: 0, Save: 0 }
  );
  const engBreakdownData = Object.entries(engagementBreakdown).map(([name, value]) => ({ name, value }));

  const filteredContent = breakdownFilter
    ? contentSeries.filter((c) => {
        const k = breakdownFilter;
        if (k === "Like") return c.likes > 0;
        if (k === "Comment") return c.comments > 0;
        if (k === "Share") return c.shares > 0;
        if (k === "Save") return c.saves > 0;
        return true;
      })
    : contentSeries;

  const engagementTrend = filteredContent.map((c) => ({
    id: c.id,
    date: format(new Date(c.post_date), "dd MMM"),
    title: c.title || format(new Date(c.post_date), "dd MMM"),
    link: normalizeLink(c.link, platform),
    Engagement: c.engagement,
    Rate: Math.round(c.engagement_rate * 10000) / 100,
  }));

  const topContentData = topContent.map((c, i) => ({
    id: c.id,
    name: shortLabel(c, i),
    title: c.title || "",
    date: format(new Date(c.post_date), "dd MMM yyyy"),
    link: normalizeLink(c.link, platform),
    Engagement: c.engagement,
    Reach: isTT ? c.plays : c.reach,
    Rate: Math.round(c.engagement_rate * 10000) / 100,
  }));

  function handleTopClick(data: unknown) {
    const p = data as { id?: number };
    if (p?.id) gotoDetail(p.id);
  }

  function handleTrendClick(data: unknown) {
    const p = data as { activePayload?: Array<{ payload?: { id?: number } }> };
    const row = p?.activePayload?.[0]?.payload;
    if (row?.id) {
      setHighlightId(row.id);
      gotoDetail(row.id);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Pertumbuhan Followers" subtitle={rangeLabel}>
        {followersData.length === 0 ? (<NoData />) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={followersData}>
              <defs>
                <linearGradient id="fFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3757fa" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3757fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <Tooltip contentStyle={ttStyle} />
              <Area type="monotone" dataKey="Followers" stroke="#3757fa" strokeWidth={2.5} fill="url(#fFollowers)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title={isTT ? "Views & Profile Views Harian" : "Visit & Reach Harian"} subtitle={rangeLabel}>
        {reachData.length === 0 ? (<NoData />) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={reachData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Visit" stroke="#E1306C" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Reach" stroke="#3757fa" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Rincian Engagement"
        subtitle={
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="w-3 h-3" /> Klik bar untuk filter chart lain
            {breakdownFilter && (
              <button onClick={() => setBreakdownFilter(null)} className="text-brand-600 underline ml-2">Reset</button>
            )}
          </span>
        }
      >
        {contentSeries.length === 0 ? (<NoData />) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={engBreakdownData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={ttStyle} />
              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
                cursor="pointer"
                onClick={(data: unknown) => {
                  const d = data as { name: "Like" | "Comment" | "Share" | "Save" };
                  setBreakdownFilter(breakdownFilter === d.name ? null : d.name);
                }}
              >
                {engBreakdownData.map((e) => (
                  <Cell
                    key={e.name}
                    fill={breakdownFilter && breakdownFilter !== e.name ? "#cbd5e1" : KIND_COLORS[e.name as keyof typeof KIND_COLORS]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title={`Tren Engagement per Post${breakdownFilter ? ` (filter: ${breakdownFilter})` : ""}`}
        subtitle={
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="w-3 h-3" /> Klik titik untuk lihat detail konten
          </span>
        }
      >
        {engagementTrend.length === 0 ? (<NoData />) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={engagementTrend} onClick={handleTrendClick} style={{ cursor: "pointer" }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={ttStyle}
                content={<TrendTooltip />}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="Engagement" stroke="#3757fa" strokeWidth={2.5}
                dot={(props: unknown) => {
                  const p = props as { cx: number; cy: number; payload: { id: number; link: string | null } };
                  const highlight = highlightId === p.payload.id;
                  return <circle key={p.payload.id} cx={p.cx} cy={p.cy} r={highlight ? 6 : 4}
                    fill={p.payload.link ? "#3757fa" : "#94a3b8"}
                    stroke={highlight ? "#f59e0b" : "#fff"} strokeWidth={highlight ? 3 : 2} />;
                }}
              />
              <Line yAxisId="right" type="monotone" dataKey="Rate" stroke="#10b981" strokeWidth={2} dot={false} name="Rate (%)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard
          title={`Top ${Math.min(10, topContentData.length)} Konten`}
          subtitle={
            <span className="flex items-center gap-1.5">
              Diurut berdasarkan {sortLabel[sortBy] || "Engagement"} • {rangeLabel}
              <span className="text-slate-300">•</span>
              <MousePointerClick className="w-3 h-3" /> Klik bar untuk lihat detail
            </span>
          }
        >
          {topContentData.length === 0 ? (<NoData />) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topContentData} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
                <Tooltip contentStyle={ttStyle} content={<TopTooltip isTT={isTT} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Engagement" fill="#E1306C" radius={[8, 8, 0, 0]} cursor="pointer" onClick={handleTopClick} />
                <Bar dataKey="Reach" name={isTT ? "Plays" : "Reach"} fill="#3757fa" radius={[8, 8, 0, 0]} cursor="pointer" onClick={handleTopClick} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ payload?: { title?: string; date?: string; link?: string | null; Engagement?: number; Reach?: number; Rate?: number; id?: number } }>;
  label?: string;
};

function TopTooltip({ active, payload, isTT }: TooltipPayload & { isTT?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      {row.title && <div className="font-semibold text-slate-900 mb-1 break-words">{row.title}</div>}
      <div className="text-slate-500 mb-2">{row.date}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-slate-500">Engagement</div><div className="font-semibold text-right">{fmtNum(row.Engagement || 0)}</div>
        <div className="text-slate-500">{isTT ? "Plays" : "Reach"}</div><div className="font-semibold text-right">{fmtNum(row.Reach || 0)}</div>
        <div className="text-slate-500">Rate</div><div className="font-semibold text-right">{(row.Rate || 0).toFixed(2)}%</div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 text-brand-600 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> Klik untuk lihat detail
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      {row.title && <div className="font-semibold text-slate-900 mb-1 max-w-xs break-words">{row.title}</div>}
      <div className="text-slate-500 mb-2">{row.date}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-slate-500">Engagement</div><div className="font-semibold text-right">{fmtNum(row.Engagement || 0)}</div>
        <div className="text-slate-500">Rate</div><div className="font-semibold text-right">{(row.Rate || 0).toFixed(2)}%</div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 text-brand-600 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> Klik titik untuk lihat detail
      </div>
    </div>
  );
}

const ttStyle = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.06)",
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
      </div>
      <div className="card-bd">{children}</div>
    </div>
  );
}

function NoData() {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
      Belum ada data untuk periode ini.
    </div>
  );
}

// Suppress unused var warning while keeping color palette for future extension
void KEY_COLORS;
