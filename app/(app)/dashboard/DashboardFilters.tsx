"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Filter, Printer, RotateCcw, Calendar, ArrowDownWideNarrow, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { monthWindow, currentMonth } from "@/lib/dates";
import DateField from "@/components/DateField";

type Range = "7d" | "30d" | "90d" | "month" | "custom";
type SortBy = "engagement" | "reach" | "likes" | "comments" | "shares" | "saves" | "rate" | "date";

const RANGE_OPTS: { v: Range; label: string }[] = [
  { v: "7d", label: "7 Hari" },
  { v: "30d", label: "30 Hari" },
  { v: "90d", label: "90 Hari" },
  { v: "month", label: "Per Bulan" },
  { v: "custom", label: "Custom" },
];

const SORT_LABEL: Record<SortBy, string> = {
  engagement: "Engagement",
  reach: "Reach / Plays",
  likes: "Like",
  comments: "Comment",
  shares: "Share",
  saves: "Save",
  rate: "Engagement Rate",
  date: "Tanggal Post",
};

export default function DashboardFilters({
  range,
  from,
  to,
  month,
  sortBy,
  minEng,
  linkOnly,
  account,
  week,
}: {
  range: Range;
  from: string;
  to: string;
  month: string;
  sortBy: SortBy;
  minEng: number;
  linkOnly: boolean;
  account: number;
  week: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [minEngLocal, setMinEngLocal] = useState(String(minEng || ""));
  const [linkOnlyLocal, setLinkOnlyLocal] = useState(linkOnly);
  const [sortLocal, setSortLocal] = useState<SortBy>(sortBy);
  const [pending, start] = useTransition();

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    params.set("account", String(account));
    params.set("week", week);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    start(() => router.push(`/dashboard?${params.toString()}`));
  }

  function pickRange(r: Range) {
    if (r === "custom") {
      pushParams({ range: "custom", from: customFrom, to: customTo, month: null });
    } else if (r === "month") {
      pushParams({ range: "month", month: month || currentMonth(), from: null, to: null });
    } else {
      pushParams({ range: r, from: null, to: null, month: null });
    }
  }

  function applyCustom() {
    pushParams({ range: "custom", from: customFrom, to: customTo, month: null });
  }

  function pickMonth(m: string) {
    pushParams({ range: "month", month: m, from: null, to: null });
  }

  const months = monthWindow(6, 6);

  function applyContentFilters() {
    pushParams({
      sortBy: sortLocal === "engagement" ? null : sortLocal,
      minEng: minEngLocal && Number(minEngLocal) > 0 ? minEngLocal : null,
      linkOnly: linkOnlyLocal ? "1" : null,
    });
  }

  function resetAll() {
    setCustomFrom("");
    setCustomTo("");
    setMinEngLocal("");
    setLinkOnlyLocal(false);
    setSortLocal("engagement");
    const params = new URLSearchParams();
    params.set("account", String(account));
    params.set("week", week);
    start(() => router.push(`/dashboard?${params.toString()}`));
  }

  const activeCount =
    (range !== "30d" ? 1 : 0) +
    (sortBy !== "engagement" ? 1 : 0) +
    (minEng > 0 ? 1 : 0) +
    (linkOnly ? 1 : 0);

  return (
    <div className="card no-print">
      <div className="card-bd space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-brand-600" />
              Rentang Waktu:
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {RANGE_OPTS.map((o) => (
                <button
                  key={o.v}
                  onClick={() => pickRange(o.v)}
                  disabled={pending}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    range === o.v
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className={cn("btn-secondary relative", expanded && "!bg-brand-50 !border-brand-200 !text-brand-700")}
            >
              <Filter className="w-4 h-4" />
              Filter Konten
              {activeCount > 0 && (
                <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-[10px] grid place-items-center">
                  {activeCount}
                </span>
              )}
            </button>
            <button onClick={() => window.print()} className="btn-primary">
              <Printer className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {range === "custom" && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="min-w-[200px]">
              <DateField compact label="Dari Tanggal" value={customFrom} onChange={setCustomFrom} />
            </div>
            <div className="min-w-[200px]">
              <DateField compact label="Sampai Tanggal" value={customTo} onChange={setCustomTo} />
            </div>
            <button onClick={applyCustom} disabled={pending || !customFrom || !customTo} className="btn-primary mb-4">
              Terapkan
            </button>
          </div>
        )}

        {range === "month" && (
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="label !text-xs">Pilih Bulan</label>
              <select className="input" value={month || currentMonth()} onChange={(e) => pickMonth(e.target.value)} disabled={pending}>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {expanded && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label !text-xs flex items-center gap-1.5">
                  <ArrowDownWideNarrow className="w-3.5 h-3.5" /> Urutkan Top Konten
                </label>
                <select className="input" value={sortLocal} onChange={(e) => setSortLocal(e.target.value as SortBy)}>
                  {(Object.keys(SORT_LABEL) as SortBy[]).map((s) => (
                    <option key={s} value={s}>{SORT_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label !text-xs">Minimum Engagement</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={minEngLocal}
                  onChange={(e) => setMinEngLocal(e.target.value)}
                  placeholder="0 (semua konten)"
                />
                <div className="hint">Sembunyikan konten di bawah nilai ini.</div>
              </div>
              <div>
                <label className="label !text-xs flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Konten dengan Link
                </label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkOnlyLocal}
                    onChange={(e) => setLinkOnlyLocal(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">Tampilkan hanya konten yang punya link</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button onClick={resetAll} className="btn-ghost text-slate-500" disabled={pending}>
                <RotateCcw className="w-4 h-4" /> Reset Semua Filter
              </button>
              <button onClick={applyContentFilters} className="btn-primary" disabled={pending}>
                Terapkan Filter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
