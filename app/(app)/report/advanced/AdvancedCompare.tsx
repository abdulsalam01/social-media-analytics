"use client";
import { useState, useMemo } from "react";
import { Crown, ExternalLink, Trophy } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import type { Account } from "@/lib/db";
import { fmtNum, fmtPct, fmtDate, cn } from "@/lib/utils";

type Post = {
  id: number;
  post_date: string;
  title: string | null;
  link: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  reach: number;
  plays: number;
  impression: number;
  engagement: number;
  engagement_rate: number;
};

const COLORS = ["#4f46e5", "#ec4899", "#10b981", "#f59e0b", "#06b6d4"];

const METRICS_IG = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "reposts", label: "Reposts" },
  { key: "reach", label: "Reach" },
  { key: "impression", label: "Impression" },
  { key: "engagement", label: "Engagement" },
] as const;

const METRICS_TT = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "reposts", label: "Reposts" },
  { key: "plays", label: "Plays" },
  { key: "engagement", label: "Engagement" },
] as const;

function shortTitle(p: Post): string {
  const t = p.title?.trim();
  if (t && t.length > 0) return t.length > 40 ? t.slice(0, 40) + "…" : t;
  return `#${p.id} · ${p.post_date}`;
}

export default function AdvancedCompare({
  account, posts, initialSelectedIds,
}: {
  account: Account;
  posts: Post[];
  initialSelectedIds: number[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelectedIds));
  const [search, setSearch] = useState("");
  const isTT = account.platform === "tiktok";
  const METRICS = isTT ? METRICS_TT : METRICS_IG;

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        p.post_date.includes(q) ||
        String(p.id).includes(q)
    );
  }, [posts, search]);

  const selectedPosts = useMemo(
    () => posts.filter((p) => selected.has(p.id)),
    [posts, selected]
  );

  function toggle(id: number) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  // Bar chart data: one row per metric, one bar per selected post
  const barData = useMemo(() => {
    return METRICS.map((m) => {
      const row: Record<string, number | string> = { metric: m.label };
      selectedPosts.forEach((p) => {
        row[shortTitle(p)] = (p as unknown as Record<string, number>)[m.key];
      });
      return row;
    });
  }, [selectedPosts, METRICS]);

  // Radar data: normalized 0-100 per metric, so posts of different scales overlap fairly
  const radarData = useMemo(() => {
    if (selectedPosts.length === 0) return [];
    return METRICS.map((m) => {
      const values = selectedPosts.map((p) => (p as unknown as Record<string, number>)[m.key]);
      const max = Math.max(...values, 1);
      const row: Record<string, number | string> = { metric: m.label };
      selectedPosts.forEach((p) => {
        const v = (p as unknown as Record<string, number>)[m.key];
        row[shortTitle(p)] = Math.round((v / max) * 100);
      });
      return row;
    });
  }, [selectedPosts, METRICS]);

  // Winner per metric — highlight best value
  function winnerForMetric(key: string): number | null {
    if (selectedPosts.length < 2) return null;
    let best = -Infinity;
    let winnerId: number | null = null;
    selectedPosts.forEach((p) => {
      const v = (p as unknown as Record<string, number>)[key];
      if (v > best) { best = v; winnerId = p.id; }
    });
    return winnerId;
  }

  // Total engagement winner (overall)
  const overallWinner = useMemo(() => {
    if (selectedPosts.length < 2) return null;
    let best = -Infinity;
    let id: number | null = null;
    selectedPosts.forEach((p) => {
      if (p.engagement > best) { best = p.engagement; id = p.id; }
    });
    return id;
  }, [selectedPosts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 card">
        <div className="card-hd">
          <div>
            <div className="font-semibold text-slate-900">Pilih Konten</div>
            <div className="text-xs text-slate-500">Max 5 · {selected.size} dipilih</div>
          </div>
        </div>
        <div className="card-bd space-y-2">
          <input
            className="input !text-sm"
            placeholder="Cari judul / tanggal / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[500px] overflow-y-auto space-y-1 -mx-1 px-1">
            {filteredPosts.length === 0 && (
              <div className="text-xs text-slate-400 py-4 text-center">Tidak ada hasil.</div>
            )}
            {filteredPosts.map((p) => {
              const isSel = selected.has(p.id);
              const color = isSel ? COLORS[[...selected].indexOf(p.id) % COLORS.length] : undefined;
              const canAdd = isSel || selected.size < 5;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  disabled={!canAdd}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                    isSel ? "bg-brand-50 border-brand-200" : "bg-white border-slate-200 hover:bg-slate-50",
                    !canAdd && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1 w-3 h-3 rounded-full shrink-0 border",
                        isSel ? "border-transparent" : "border-slate-300"
                      )}
                      style={isSel ? { backgroundColor: color } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {p.title ?? <span className="text-slate-400 italic">Tanpa judul</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{fmtDate(p.post_date)}</span>
                        <span>·</span>
                        <span>Eng: {fmtNum(p.engagement)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {selectedPosts.length < 2 ? (
          <div className="card">
            <div className="card-bd text-center py-12">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-700">Pilih minimal 2 konten</div>
              <div className="text-xs text-slate-500 mt-1">
                Bandingkan performa, lihat winner per metrik, chart, radar.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Winner card */}
            {overallWinner !== null && (
              <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <div className="card-bd flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 grid place-items-center text-white shadow-sm">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Total Engagement Winner</div>
                    <div className="text-lg font-bold text-slate-900">
                      {shortTitle(selectedPosts.find((p) => p.id === overallWinner)!)}
                    </div>
                    <div className="text-xs text-slate-600">
                      {fmtNum(selectedPosts.find((p) => p.id === overallWinner)!.engagement)} engagement
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bar chart */}
            <div className="card">
              <div className="card-hd">
                <div className="font-semibold text-slate-900">Chart Perbandingan Metrik</div>
                <div className="text-xs text-slate-500">Absolute value per konten</div>
              </div>
              <div className="card-bd">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {selectedPosts.map((p, i) => (
                      <Bar key={p.id} dataKey={shortTitle(p)} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar chart */}
            <div className="card">
              <div className="card-hd">
                <div className="font-semibold text-slate-900">Radar (Normalized 0-100)</div>
                <div className="text-xs text-slate-500">Skala relatif tiap metrik — untuk lihat &quot;shape&quot; performa</div>
              </div>
              <div className="card-bd">
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {selectedPosts.map((p, i) => (
                      <Radar
                        key={p.id}
                        name={shortTitle(p)}
                        dataKey={shortTitle(p)}
                        stroke={COLORS[i % COLORS.length]}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.15}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed table with winner highlight */}
            <div className="card">
              <div className="card-hd">
                <div className="font-semibold text-slate-900">Tabel Perbandingan</div>
                <div className="text-xs text-slate-500">
                  <Crown className="w-3 h-3 inline text-amber-500" /> menandai winner per metrik
                </div>
              </div>
              <div className="card-bd p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-slate-500 border-b border-slate-100">
                        <th className="px-4 py-3 text-left">Metrik</th>
                        {selectedPosts.map((p, i) => (
                          <th key={p.id} className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              <span className="truncate max-w-[120px]" title={shortTitle(p)}>
                                {shortTitle(p)}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((m) => {
                        const winnerId = winnerForMetric(m.key);
                        return (
                          <tr key={m.key} className="border-b border-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{m.label}</td>
                            {selectedPosts.map((p) => {
                              const v = (p as unknown as Record<string, number>)[m.key];
                              const isWinner = winnerId === p.id;
                              return (
                                <td
                                  key={p.id}
                                  className={cn(
                                    "px-4 py-2.5 text-right tabular-nums",
                                    isWinner ? "font-semibold text-amber-700 bg-amber-50" : "text-slate-600"
                                  )}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {isWinner && <Crown className="w-3 h-3 text-amber-500" />}
                                    {fmtNum(v)}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="border-b border-slate-50 bg-slate-50/40">
                        <td className="px-4 py-2.5 font-medium text-slate-700">Engagement Rate</td>
                        {selectedPosts.map((p) => (
                          <td key={p.id} className="px-4 py-2.5 text-right text-slate-600 tabular-nums">
                            {fmtPct(p.engagement_rate)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-slate-700">Tanggal Post</td>
                        {selectedPosts.map((p) => (
                          <td key={p.id} className="px-4 py-2.5 text-right text-xs text-slate-500">
                            {fmtDate(p.post_date)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-slate-700">Link</td>
                        {selectedPosts.map((p) => (
                          <td key={p.id} className="px-4 py-2.5 text-right">
                            {p.link ? (
                              <a
                                href={p.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" /> Buka
                              </a>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
