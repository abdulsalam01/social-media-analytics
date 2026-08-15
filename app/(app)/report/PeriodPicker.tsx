"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { weekStartOf, recentMonths, currentMonth } from "@/lib/dates";

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
  const months = recentMonths(24);

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
        <div className="flex items-center gap-1">
          <button className="btn-secondary !px-2" onClick={() => shiftWeek(-7)} disabled={pending}>◀</button>
          <input
            type="date"
            className="input !w-auto"
            value={week}
            onChange={(e) => push({ mode: "week", week: weekStartOf(e.target.value) })}
          />
          <button className="btn-secondary !px-2" onClick={() => shiftWeek(7)} disabled={pending}>▶</button>
        </div>
      )}

      {mode === "month" && (
        <select
          className="input !w-auto"
          value={month || currentMonth()}
          onChange={(e) => push({ mode: "month", month: e.target.value })}
          disabled={pending}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      {mode === "range" && (
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" className="input !w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span className="text-slate-400">—</span>
          <input type="date" className="input !w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          <button
            onClick={() => push({ mode: "range", from: customFrom, to: customTo })}
            disabled={pending || !customFrom || !customTo}
            className="btn-primary !py-1.5"
          >
            Terapkan
          </button>
        </div>
      )}
    </div>
  );
}
