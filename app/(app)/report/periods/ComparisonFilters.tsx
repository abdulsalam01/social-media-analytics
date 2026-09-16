"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import DateField from "@/components/DateField";
import { monthRange, shiftISODate } from "@/lib/dates";
import { precedingRange, rangeDays, validComparisonRange, type ComparisonBasis, type ComparisonRange } from "@/lib/report-comparison";

export default function ComparisonFilters({ accountId, range1, range2, basis, today }: {
  accountId: number;
  range1: ComparisonRange;
  range2: ComparisonRange;
  basis: ComparisonBasis;
  today: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [first, setFirst] = useState(range1);
  const [second, setSecond] = useState(range2);
  const [selectedBasis, setSelectedBasis] = useState(basis);
  const [pending, start] = useTransition();
  const valid1 = validComparisonRange(first);
  const valid2 = validComparisonRange(second);

  function preset(days: number) {
    const recent = { from: shiftISODate(today, -(days - 1)), to: today };
    setSecond(recent);
    setFirst(precedingRange(recent));
  }

  function months() {
    const [year, month] = today.split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    const lastMonth = monthRange(previous);
    setFirst({ from: lastMonth.from, to: lastMonth.to });
    setSecond({ from: `${today.slice(0, 7)}-01`, to: today });
    setSelectedBasis("daily");
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!valid1 || !valid2) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("account", String(accountId));
    params.set("from1", first.from);
    params.set("to1", first.to);
    params.set("from2", second.from);
    params.set("to2", second.to);
    params.set("basis", selectedBasis);
    start(() => router.push(`/report/periods?${params.toString()}`));
  }

  return (
    <form onSubmit={apply} className="card no-print" aria-label="Filter perbandingan dua rentang waktu" aria-busy={pending}>
      <fieldset className="card-bd space-y-4" disabled={pending}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold text-slate-900">Filter Lanjutan</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !py-1 !px-2 text-xs" onClick={() => preset(7)}>7 vs 7 hari</button>
            <button type="button" className="btn-ghost !py-1 !px-2 text-xs" onClick={() => preset(30)}>30 vs 30 hari</button>
            <button type="button" className="btn-ghost !py-1 !px-2 text-xs" onClick={months}>Bulan lalu vs bulan ini</button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([{ number: 1, label: "Rentang 1 · Baseline", range: first, update: setFirst, valid: valid1 },
             { number: 2, label: "Rentang 2 · Evaluasi", range: second, update: setSecond, valid: valid2 }]).map(({ number, label, range, update, valid }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between items-center mb-3 text-xs font-semibold text-slate-700">
                <span>{label}</span>
                {valid && <span className="text-brand-600">{rangeDays(range)} hari</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateField label={`Tanggal awal (Start ${number})`} compact required value={range.from} max={range.to || undefined} onChange={(from) => update((current) => ({ ...current, from }))} />
                <DateField label={`Tanggal akhir (End ${number})`} compact required value={range.to} min={range.from || undefined} onChange={(to) => update((current) => ({ ...current, to }))} />
              </div>
              {!valid && <div className="text-xs text-red-600 mt-2" role="alert">Pilih tanggal yang valid; tanggal akhir tidak boleh sebelum tanggal awal.</div>}
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <label htmlFor="comparison-basis" className="label !text-xs">Basis perbandingan</label>
            <select id="comparison-basis" className="input !w-auto" value={selectedBasis} onChange={(event) => setSelectedBasis(event.target.value as ComparisonBasis)}>
              <option value="total">Total per rentang</option>
              <option value="daily">Rata-rata per hari (normalisasi durasi)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="btn-secondary text-xs" onClick={() => { setFirst(second); setSecond(first); }}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Tukar rentang
            </button>
            <button type="button" className="btn-secondary text-xs" disabled={!valid2 || pending} onClick={() => setFirst(precedingRange(second))}>
              Rentang 1 = periode sebelum Rentang 2
            </button>
            <button type="submit" className="btn-primary" disabled={!valid1 || !valid2 || pending}>
              {pending && <RefreshCw className="w-4 h-4 animate-spin" />}
              {pending ? "Menghitung…" : "Bandingkan"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">Tanggal awal dan akhir ikut dihitung. Perubahan = Rentang 2 − Rentang 1. Filter baru dijalankan setelah klik Bandingkan.</p>
      </fieldset>
    </form>
  );
}
