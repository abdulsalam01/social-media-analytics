"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, Check, Users2, Activity, Eye, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/db";
import PlatformBadge from "@/components/PlatformBadge";

type Range = "7d" | "30d" | "90d" | "custom";

const RANGE_OPTS: { v: Range; label: string }[] = [
  { v: "7d", label: "7 Hari" }, { v: "30d", label: "30 Hari" }, { v: "90d", label: "90 Hari" }, { v: "custom", label: "Custom" },
];

const METRICS = [
  { v: "engagement", label: "Engagement", icon: Activity },
  { v: "followers", label: "Followers", icon: Users2 },
  { v: "reach", label: "Reach / Plays", icon: Eye },
  { v: "rate", label: "Engagement Rate", icon: TrendingUp },
];

export default function CompareFilters({
  allAccounts, selectedIds, range, from, to, metric,
}: {
  allAccounts: Account[]; selectedIds: number[];
  range: string; from: string; to: string; metric: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [dropdown, setDropdown] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    start(() => router.push(`/compare?${params.toString()}`));
  }

  function toggleBrand(id: number) {
    let next: number[];
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) return;
      next = selectedIds.filter((x) => x !== id);
    } else {
      if (selectedIds.length >= 4) return;
      next = [...selectedIds, id];
    }
    pushParams({ accounts: next.join(",") });
  }

  return (
    <div className="card no-print">
      <div className="card-bd space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="label flex items-center gap-1.5"><Users2 className="w-4 h-4 text-brand-600" /> Brand (2-4)</label>
            <div className="relative">
              <button
                onClick={() => setDropdown((v) => !v)}
                className="input text-left flex items-center justify-between"
              >
                <span className="truncate">{selectedIds.length} brand dipilih</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {dropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdown(false)} />
                  <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto card">
                    <div className="p-1">
                      {allAccounts.map((a) => {
                        const isSel = selectedIds.includes(a.id);
                        const disabled = !isSel && selectedIds.length >= 4;
                        return (
                          <button
                            key={a.id}
                            onClick={() => toggleBrand(a.id)}
                            disabled={disabled}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left",
                              isSel ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50",
                              disabled && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <div className={cn("w-4 h-4 rounded border grid place-items-center", isSel ? "bg-brand-600 border-brand-600" : "border-slate-300")}>
                              {isSel && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="flex-1 truncate">{a.name}</span>
                            <PlatformBadge platform={a.platform} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-2 border-t border-slate-100 text-[11px] text-slate-500">
                      Pilih 2-4 brand untuk head-to-head.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Calendar className="w-4 h-4 text-brand-600" /> Rentang Waktu</label>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full">
              {RANGE_OPTS.map((o) => (
                <button
                  key={o.v}
                  onClick={() => pushParams({ range: o.v, from: o.v === "custom" ? localFrom : null, to: o.v === "custom" ? localTo : null })}
                  disabled={pending}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                    range === o.v ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">Metric Utama Chart</label>
            <div className="grid grid-cols-2 gap-1">
              {METRICS.map((m) => {
                const Icon = m.icon;
                const active = metric === m.v;
                return (
                  <button
                    key={m.v}
                    onClick={() => pushParams({ metric: m.v })}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border",
                      active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {range === "custom" && (
          <div className="flex items-end gap-2 pt-3 border-t border-slate-100">
            <div><label className="label !text-xs">Dari</label><input type="date" className="input" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} /></div>
            <div><label className="label !text-xs">Sampai</label><input type="date" className="input" value={localTo} onChange={(e) => setLocalTo(e.target.value)} /></div>
            <button
              onClick={() => pushParams({ range: "custom", from: localFrom, to: localTo })}
              disabled={pending || !localFrom || !localTo}
              className="btn-primary"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
