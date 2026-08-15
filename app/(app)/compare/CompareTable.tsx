import { fmtNum, fmtPct } from "@/lib/utils";
import PlatformBadge from "@/components/PlatformBadge";
import type { Account } from "@/lib/db";
import type { BrandStats } from "@/lib/compare";
import { Crown, TrendingUp, TrendingDown } from "lucide-react";

type Brand = { account: Account; color: string; stats: BrandStats };

type MetricRow = { key: string; label: string; isPct?: boolean; higherBetter?: boolean };

const METRICS: MetricRow[] = [
  { key: "latest_followers", label: "Followers Saat Ini" },
  { key: "followers_growth", label: "Followers Growth" },
  { key: "total_content", label: "Total Konten" },
  { key: "total_engagement", label: "Total Engagement" },
  { key: "total_likes", label: "Total Like" },
  { key: "total_comments", label: "Total Comment" },
  { key: "total_shares", label: "Total Share" },
  { key: "total_saves", label: "Total Save" },
  { key: "total_reach", label: "Total Reach" },
  { key: "total_plays", label: "Total Plays (TikTok)" },
  { key: "avg_engagement_rate", label: "Avg Engagement Rate", isPct: true },
];

export default function CompareTable({ brands }: { brands: Brand[] }) {
  function winnerIndex(key: string): number {
    let bestVal = -Infinity;
    let bestIdx = -1;
    brands.forEach((b, i) => {
      const v = (b.stats as unknown as Record<string, number>)[key];
      if (v > bestVal) { bestVal = v; bestIdx = i; }
    });
    if (bestVal === 0) return -1;
    return bestIdx;
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="font-semibold text-slate-900">Perbandingan Metric</div>
          <div className="text-xs text-slate-500">Angka tertinggi di tiap baris disorot 👑</div>
        </div>
      </div>
      <div className="card-bd p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs uppercase text-slate-500">Metric</th>
              {brands.map((b) => (
                <th key={b.account.id} className="text-right px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{b.account.name}</div>
                      <div className="text-[10px] text-slate-500">@{b.account.handle}</div>
                    </div>
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    <PlatformBadge platform={b.account.platform} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const winner = winnerIndex(m.key);
              return (
                <tr key={m.key} className="border-b border-slate-50">
                  <td className="px-5 py-2.5 text-slate-700">{m.label}</td>
                  {brands.map((b, i) => {
                    const raw = (b.stats as unknown as Record<string, number>)[m.key];
                    const isWinner = i === winner;
                    return (
                      <td key={b.account.id} className="px-5 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {m.key === "followers_growth" && raw !== 0 && (
                            raw > 0
                              ? <TrendingUp className="w-3 h-3 text-emerald-600" />
                              : <TrendingDown className="w-3 h-3 text-red-600" />
                          )}
                          <span className={isWinner ? "font-bold text-slate-900" : "text-slate-600"}>
                            {m.isPct ? fmtPct(raw) : fmtNum(raw)}
                          </span>
                          {isWinner && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
