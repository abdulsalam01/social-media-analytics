import { ArrowDownRight, ArrowUpRight, AlertTriangle, Minus } from "lucide-react";
import AccountPicker from "@/components/AccountPicker";
import EmptyState from "@/components/EmptyState";
import PlatformBadge from "@/components/PlatformBadge";
import { getAccessibleAccounts, resolveActiveAccount } from "@/lib/account-access";
import { dbAll } from "@/lib/db";
import { todayInTimeZone } from "@/lib/dates";
import { requirePageRole } from "@/lib/session";
import { fmtDate, fmtNum, fmtPct } from "@/lib/utils";
import {
  comparisonMetrics, formatComparisonValue, periodComparisonArgs, PERIOD_COMPARISON_SQL,
  rangeDays, resolveComparisonRanges, type ComparisonAggregate, type ComparisonBasis,
  type ComparisonMetric, type ComparisonRange,
} from "@/lib/report-comparison";
import PrintButton from "../PrintButton";
import ReportSubNav from "../ReportSubNav";
import ComparisonFilters from "./ComparisonFilters";
import ExportComparison from "./ExportComparison";

export const dynamic = "force-dynamic";

export default async function PeriodComparisonPage({ searchParams }: {
  searchParams: Promise<{ account?: string; from1?: string; to1?: string; from2?: string; to2?: string; basis?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageRole(["admin", "editor", "viewer"]);
  const accounts = await getAccessibleAccounts(user);
  if (!accounts.length) {
    return <EmptyState
      title={user.role === "admin" ? "Belum ada akun" : "Belum ada akun yang ditugaskan"}
      description="Pilih akun yang dapat kamu akses untuk membandingkan laporan dua periode."
      ctaHref={user.role === "admin" ? "/accounts/new" : undefined}
      ctaLabel={user.role === "admin" ? "Tambah Akun" : undefined}
    />;
  }
  const account = await resolveActiveAccount(accounts, sp.account);
  const today = todayInTimeZone();
  const { range1, range2, notices, overlapDays } = resolveComparisonRanges(sp, today);
  const basis: ComparisonBasis = sp.basis === "daily" ? "daily" : "total";
  const days1 = rangeDays(range1);
  const days2 = rangeDays(range2);

  // One aggregate query, one consistent DB snapshot, no per-post queries or raw content payload.
  const summaries = await dbAll<ComparisonAggregate>(
    PERIOD_COMPARISON_SQL, periodComparisonArgs(account.id, range1, range2)
  );
  if (summaries.length !== 2) throw new Error("Ringkasan perbandingan periode tidak lengkap");
  const [data1, data2] = summaries;
  const metrics = comparisonMetrics(data1, data2, days1, days2, basis, account.platform);
  const engagement = metrics.find((metric) => metric.key === "engagement")!;
  const warnings = [...notices];
  if (overlapDays) warnings.push(`Kedua rentang beririsan ${overlapDays} hari. Data tanggal tersebut dihitung secara independen pada masing-masing rentang.`);
  if (days1 !== days2 && basis === "total") warnings.push(`Durasi berbeda (${days1} vs ${days2} hari). Gunakan basis rata-rata per hari untuk membandingkan volume pada durasi yang setara.`);
  const noPeriodData = data1.posts === 0 && data2.posts === 0 && data1.profile_days === 0 && data2.profile_days === 0;

  return (
    <div className="space-y-6">
      <div className="no-print flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandingkan Periode</h1>
          <p className="text-sm text-slate-500">Dua rentang tanggal, perubahan absolut, pertumbuhan relatif, dan normalisasi durasi.</p>
          <div className="mt-3"><ReportSubNav /></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountPicker accounts={accounts} current={account.id} basePath="/report/periods" />
          <ExportComparison accountName={account.name} accountId={account.id} range1={range1} range2={range2} basis={basis} metrics={metrics} />
          <PrintButton />
        </div>
      </div>

      <ComparisonFilters
        key={[range1.from, range1.to, range2.from, range2.to, basis].join(":")}
        accountId={account.id} range1={range1} range2={range2} basis={basis} today={today}
      />

      {!!warnings.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3" role="status">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-brand-600 to-brand-400 text-white flex justify-between items-start gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Laporan perbandingan dua periode</div>
            <h2 className="text-2xl font-bold mt-1">{account.name}</h2>
            <div className="text-sm mt-1 opacity-90">@{account.handle} · {basis === "daily" ? "Rata-rata per hari kalender" : "Total per rentang"}</div>
            <div className="text-xs mt-2 opacity-80">Dibuat {fmtDate(today)} · Selisih = Rentang 2 − Rentang 1</div>
          </div>
          <PlatformBadge platform={account.platform} size="md" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RangeCard label="Rentang 1 · Baseline" range={range1} data={data1} />
            <RangeCard label="Rentang 2 · Evaluasi" range={range2} data={data2} />
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="text-xs font-semibold text-brand-700">Perubahan engagement{basis === "daily" ? " per hari" : ""}</div>
              <div className="text-2xl font-bold text-slate-900 my-3">{formatComparisonValue(engagement.value2, engagement, basis)}</div>
              <Delta metric={engagement} basis={basis} />
              <div className="text-xs mt-2 text-slate-500"><RelativeChange metric={engagement} /> dibanding Rentang 1</div>
            </div>
          </div>

          {noPeriodData && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600" role="status">Belum ada data profil atau konten pada kedua rentang. Snapshot followers sebelum periode tetap ditampilkan bila tersedia.</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Perbandingan {account.name}. Rentang 1 {range1.from} sampai {range1.to}, Rentang 2 {range2.from} sampai {range2.to}. Basis {basis}.</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th scope="col" className="py-3 pr-4 text-left">Metrik</th>
                  <th scope="col" className="py-3 px-3 text-right whitespace-nowrap">Rentang 1</th>
                  <th scope="col" className="py-3 px-3 text-right whitespace-nowrap">Rentang 2</th>
                  <th scope="col" className="py-3 px-3 text-right whitespace-nowrap">Selisih (2 − 1)</th>
                  <th scope="col" className="py-3 pl-3 text-right whitespace-nowrap">Perubahan relatif</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.key} className={metric.key === "engagement" ? "bg-brand-50/50 border-b border-brand-100" : "border-b border-slate-100 hover:bg-slate-50/50"}>
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-slate-700">
                      {metric.label}
                      {basis === "daily" && metric.kind === "count" && <span className="block text-[10px] font-normal text-slate-400">rata-rata / hari kalender</span>}
                    </th>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">{formatComparisonValue(metric.value1, metric, basis)}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-900">{formatComparisonValue(metric.value2, metric, basis)}</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap"><Delta metric={metric} basis={basis} /></td>
                    <td className="py-3 pl-3 text-right tabular-nums whitespace-nowrap"><RelativeChange metric={metric} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-4">
            <p>Engagement = likes + komentar + share + save + repost. ER dihitung dari total engagement ÷ total pembagi periode, bukan rata-rata ER setiap post.</p>
            <p>Followers memakai snapshot terakhir pada/sebelum tanggal akhir, bukan jumlah seluruh snapshot. Angka followers dan rasio tidak dibagi durasi.</p>
            <p>Basis harian memakai seluruh hari kalender termasuk hari tanpa input. Data profil yang belum diinput tidak berarti aktivitas akun benar-benar nol.</p>
            <p>Selisih ER ditulis dalam poin persentase (pp). Perubahan relatif = selisih ÷ |nilai Rentang 1| × 100%. Jika baseline nol, persentase relatif tidak dihitung; jika pembagi tidak tersedia, tampil —.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeCard({ label, range, data }: { label: string; range: ComparisonRange; data: ComparisonAggregate }) {
  const days = rangeDays(range);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-2">{fmtDate(range.from)} — {fmtDate(range.to)}</div>
      <div className="text-xs text-brand-600 mt-1">{fmtNum(days)} hari · {fmtNum(data.posts)} konten</div>
      <div className="text-xs text-slate-500 mt-3 space-y-1">
        <p>Data profil: {fmtNum(data.profile_days)} / {fmtNum(days)} hari</p>
        <p>Snapshot followers: {data.followers_date ? fmtDate(data.followers_date) : "belum tersedia"}</p>
        {data.followers_date && data.followers_date < range.from && <p className="text-amber-700">Snapshot followers berasal dari sebelum rentang ini.</p>}
      </div>
    </div>
  );
}

function Delta({ metric, basis }: { metric: ComparisonMetric; basis: ComparisonBasis }) {
  if (metric.delta === null) return <span className="text-slate-400">—</span>;
  if (metric.delta === 0) return <span className="badge-slate"><Minus className="w-3 h-3" /> 0{metric.kind === "rate" ? " pp" : ""}</span>;
  const positive = metric.delta > 0;
  const label = metric.kind === "rate" ? `${(Math.abs(metric.delta) * 100).toFixed(2)} pp` : formatComparisonValue(Math.abs(metric.delta), metric, basis);
  return <span className={positive ? "badge-green" : "badge-red"}>
    {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
    {positive ? "+" : "−"}{label}
  </span>;
}

function RelativeChange({ metric }: { metric: ComparisonMetric }) {
  if (metric.relativeChange === null) {
    return <span className="text-xs text-slate-400" title="Persentase relatif tidak bisa dihitung tanpa baseline yang tersedia dan bukan nol">{metric.value1 === 0 && metric.value2 !== null && metric.value2 !== 0 ? "Dari nol" : "—"}</span>;
  }
  return <span className={metric.relativeChange > 0 ? "text-emerald-700" : metric.relativeChange < 0 ? "text-red-600" : "text-slate-500"}>
    {metric.relativeChange > 0 ? "+" : metric.relativeChange < 0 ? "−" : ""}{fmtPct(Math.abs(metric.relativeChange))}
  </span>;
}
