"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { weekStartOf, monthWindow, currentMonth } from "@/lib/dates";
import DateField from "@/components/DateField";

type Mode = "week" | "month" | "range";

export default function PeriodPicker({
  mode, week, month, from, to, account,
}: {
  mode: Mode;
  week: string;
  month: string;
  from: string;
  to: string;
  account: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const months = monthWindow(6, 6);

  function push(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    params.set("account", String(account));
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    start(() => router.push(`/report?${params.toString()}`));
  }

  function pickMode(m: Mode) {
    if (m === "week") push({ mode: "week", month: null, from: null, to: null, week });
    if (m === "month") push({ mode: "month", week: null, from: null, to: null, month: month || currentMonth() });
    if (m === "range") {
      // Prefill defaults so backend never sees empty range
      const today = new Date();
      const to = today.toISOString().slice(0, 10);
      const fromD = new Date(today);
      fromD.setDate(today.getDate() - 29);
      const fromISO = fromD.toISOString().slice(0, 10);
      const prefFrom = customFrom || from || fromISO;
      const prefTo = customTo || to;
      setCustomFrom(prefFrom);
      setCustomTo(prefTo);
      push({ mode: "range", week: null, month: null, from: prefFrom, to: prefTo });
    }
  }

  function shiftWeek(days: number) {
    const d = new Date(week + "T00:00:00");
    d.setUTCDate(d.getUTCDate() + days);
    push({ mode: "week", week: weekStartOf(d.toISOString().slice(0, 10)) });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {(["week", "month", "range"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => pickMode(m)}
            disabled={pending}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
              mode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            )}
          >
            {m === "week" ? "Mingguan" : m === "month" ? "Bulanan" : "Rentang"}
          </button>
        ))}
      </div>

      {mode === "week" && (
        <div className="flex items-end gap-1">
          <button className="btn-secondary !px-2 mb-4" onClick={() => shiftWeek(-7)} disabled={pending}>◀</button>
          <div className="min-w-[220px]">
            <DateField
              compact
              value={week}
              onChange={(v) => push({ mode: "week", week: weekStartOf(v) })}
            />
          </div>
          <button className="btn-secondary !px-2 mb-4" onClick={() => shiftWeek(7)} disabled={pending}>▶</button>
        </div>
      )}

      {mode === "month" && (
        <div className="flex flex-col">
          <select
            className="input !w-auto font-medium"
            value={month || currentMonth()}
            onChange={(e) => push({ mode: "month", month: e.target.value })}
            disabled={pending}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="text-[11px] text-slate-400 mt-1">6 bulan sebelum &amp; sesudah bulan ini</div>
        </div>
      )}

      {mode === "range" && (
        <div className="flex items-end gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-slate-400 mb-4" />
          <div className="min-w-[200px]">
            <DateField compact label="Dari" value={customFrom} onChange={setCustomFrom} />
          </div>
          <span className="text-slate-400 mb-4">—</span>
          <div className="min-w-[200px]">
            <DateField compact label="Sampai" value={customTo} onChange={setCustomTo} />
          </div>
          <button
            onClick={() => push({ mode: "range", from: customFrom, to: customTo })}
            disabled={pending || !customFrom || !customTo}
            className="btn-primary !py-1.5 mb-4"
          >
            Terapkan
          </button>
        </div>
      )}
    </div>
  );
}
