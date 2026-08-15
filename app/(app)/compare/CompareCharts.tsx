"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";
import type { DailySeriesRow, ContentDailyRow } from "@/lib/compare";
import type { Platform } from "@/lib/db";

type BrandRef = { id: number; name: string; color: string; platform: Platform };

export default function CompareCharts({
  brands, dailySeries, contentDaily, metric, period,
}: {
  brands: BrandRef[];
  dailySeries: DailySeriesRow[];
  contentDaily: ContentDailyRow[];
  metric: string;
  period: string;
}) {
  const followersData = useMemo(() => pivotByDate(dailySeries, brands, "followers"), [dailySeries, brands]);
  const engagementData = useMemo(() => pivotContentByDate(contentDaily, brands), [contentDaily, brands]);
  const reachData = useMemo(() => pivotByDate(dailySeries, brands, "reach_per_day"), [dailySeries, brands]);

  const radarData = useMemo(() => {
    const maxes: Record<string, number> = { Engagement: 1, Reach: 1, Content: 1, Followers: 1, Rate: 1 };
    const rowByMetric = ["Engagement", "Reach", "Content", "Followers", "Rate"].map((m) => {
      const row: Record<string, string | number> = { metric: m };
      brands.forEach((b) => (row[b.name] = 0));
      return row;
    });
    // Compute rows from summed content + latest daily row
    const perBrand: Record<number, Record<string, number>> = {};
    for (const b of brands) perBrand[b.id] = { Engagement: 0, Reach: 0, Content: 0, Followers: 0, Rate: 0 };
    for (const c of contentDaily) {
      perBrand[c.account_id].Engagement += c.engagement;
      perBrand[c.account_id].Reach += c.total_reach_or_plays;
      perBrand[c.account_id].Content += 1;
    }
    for (const b of brands) {
      const latestRow = [...dailySeries].reverse().find((d) => d.account_id === b.id);
      perBrand[b.id].Followers = latestRow?.followers ?? 0;
      perBrand[b.id].Rate = perBrand[b.id].Reach > 0 ? (perBrand[b.id].Engagement / perBrand[b.id].Reach) * 100 : 0;
    }
    for (const key of Object.keys(maxes)) {
      for (const b of brands) {
        if (perBrand[b.id][key] > maxes[key]) maxes[key] = perBrand[b.id][key];
      }
    }
    for (const row of rowByMetric) {
      const key = row.metric as string;
      for (const b of brands) {
        row[b.name] = Math.round((perBrand[b.id][key] / maxes[key]) * 100);
      }
    }
    return rowByMetric;
  }, [contentDaily, dailySeries, brands]);

  const metricSeries = useMemo(() => {
    if (metric === "followers") return followersData;
    if (metric === "reach") return reachData;
    return engagementData;
  }, [metric, followersData, reachData, engagementData]);
  const metricLabel = { followers: "Followers", reach: "Reach / Views", engagement: "Engagement", rate: "Engagement Rate (%)" }[metric] || "Engagement";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title={`${metricLabel} Head-to-Head`} subtitle={period}>
        {metricSeries.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metricSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {brands.map((b) => (
                <Line key={b.id} type="monotone" dataKey={b.name} stroke={b.color} strokeWidth={2.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Followers Growth Trend" subtitle={period}>
        {followersData.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={followersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {brands.map((b) => (
                <Line key={b.id} type="monotone" dataKey={b.name} stroke={b.color} strokeWidth={2.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Engagement Harian" subtitle={period}>
        {engagementData.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => fmtNum(v, { compact: true })} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {brands.map((b) => (
                <Bar key={b.id} dataKey={b.name} fill={b.color} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Radar Kekuatan Brand" subtitle="Skor 0-100 (relatif tertinggi di sample)">
        {brands.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={11} />
              <PolarRadiusAxis stroke="#cbd5e1" fontSize={10} angle={30} domain={[0, 100]} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {brands.map((b) => (
                <Radar key={b.id} name={b.name} dataKey={b.name} stroke={b.color} fill={b.color} fillOpacity={0.2} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function pivotByDate(rows: DailySeriesRow[], brands: BrandRef[], field: "followers" | "reach_per_day" | "visit_per_day") {
  const map = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    const key = r.date;
    if (!map.has(key)) {
      const empty: Record<string, string | number> = { date: format(new Date(r.date), "dd MMM") };
      brands.forEach((b) => (empty[b.name] = 0));
      map.set(key, empty);
    }
    const row = map.get(key)!;
    const brand = brands.find((b) => b.id === r.account_id);
    if (brand) row[brand.name] = r[field];
  }
  return Array.from(map.values());
}

function pivotContentByDate(rows: ContentDailyRow[], brands: BrandRef[]) {
  const map = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    const key = r.post_date;
    if (!map.has(key)) {
      const empty: Record<string, string | number> = { date: format(new Date(r.post_date), "dd MMM") };
      brands.forEach((b) => (empty[b.name] = 0));
      map.set(key, empty);
    }
    const row = map.get(key)!;
    const brand = brands.find((b) => b.id === r.account_id);
    if (brand) row[brand.name] = (row[brand.name] as number) + r.engagement;
  }
  return Array.from(map.values());
}

const ttStyle = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.06)",
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
  return <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Belum ada data pada rentang ini.</div>;
}
