"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { weekStartOf, monthWindow, currentMonth, shiftISODate, todayInTimeZone } from "@/lib/dates";
import DateField from "@/components/DateField";

type Mode = "day" | "week" | "month" | "range";

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
    if (m === "day") {
      const today = todayInTimeZone();
      push({ mode: "day", week: null, month: null, to: null, from: from || today });
    }
    if (m === "week") push({ mode: "week", month: null, from: null, to: null, week });
    if (m === "month") push({ mode: "month", week: null, from: null, to: null, month: month || currentMonth() });
    if (m === "range") {
      // Prefill defaults so backend never sees empty range
      const to = todayInTimeZone();
      const fromISO = shiftISODate(to, -29);
      const prefFrom = customFrom || from || fromISO;
      const prefTo = customTo || to;
      setCustomFrom(prefFrom);
      setCustomTo(prefTo);
      push({ mode: "range", week: null, month: null, from: prefFrom, to: prefTo });
    }
  }

  function shiftWeek(days: number) {
    push({ mode: "week", week: weekStartOf(shiftISODate(week, days)) });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {(["day", "week", "month", "range"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => pickMode(m)}
            disabled={pending}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
              mode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            )}
          >
            {m === "day" ? "Harian" : m === "week" ? "Mingguan" : m === "month" ? "Bulanan" : "Rentang"}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <div className="min-w-[220px]">
          <DateField
            compact
            value={from || todayInTimeZone()}
            onChange={(v) => push({ mode: "day", from: v, to: null, week: null, month: null })}
          />
        </div>
      )}

      {mode === "week" && (
        <div className="flex items-center gap-1">
          <button className="btn-secondary !px-2" onClick={() => shiftWeek(-7)} disabled={pending}>◀</button>
          <div className="min-w-[220px]">
            <DateField
              compact
              value={week}
              onChange={(v) => push({ mode: "week", week: weekStartOf(v) })}
            />
          </div>
          <button className="btn-secondary !px-2" onClick={() => shiftWeek(7)} disabled={pending}>▶</button>
        </div>
      )}

      {mode === "month" && (
        <select
          className="input !w-auto font-medium"
          value={month || currentMonth()}
          onChange={(e) => push({ mode: "month", month: e.target.value })}
          disabled={pending}
          title="6 bulan sebelum & sesudah bulan ini"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      {mode === "range" && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="min-w-[200px]">
            <DateField compact label="Dari" value={customFrom} onChange={setCustomFrom} />
          </div>
          <div className="min-w-[200px]">
            <DateField compact label="Sampai" value={customTo} onChange={setCustomTo} />
          </div>
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
