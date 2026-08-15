import { dbAll, Account } from "@/lib/db";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import CompareFilters from "./CompareFilters";
import CompareTable from "./CompareTable";
import CompareCharts from "./CompareCharts";
import PrintButton from "./PrintButton";
import { computeBrandStats, getBrandDailySeries, getBrandContentDaily, resolveComparePeriod } from "@/lib/compare";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BRAND_COLORS = ["#3757fa", "#E1306C", "#10b981", "#f59e0b"];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ accounts?: string; range?: string; from?: string; to?: string; metric?: string }>;
}) {
  const sp = await searchParams;
  const allAccounts = await dbAll<Account>("SELECT * FROM accounts ORDER BY name ASC");

  if (allAccounts.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandingkan Brand</h1>
          <p className="text-sm text-slate-500">Head-to-head performa brand.</p>
        </div>
        <EmptyState
          title="Butuh minimal 2 akun buat compare"
          description="Tambah akun sosmed lain dulu untuk mulai membandingkan performa side-by-side."
          ctaHref="/accounts/new"
          ctaLabel="Tambah Akun"
        />
      </div>
    );
  }

  const selectedIds = (sp.accounts || "")
    .split(",")
    .map((s) => parseInt(s))
    .filter((n) => !Number.isNaN(n) && allAccounts.some((a) => a.id === n))
    .slice(0, 4);

  const activeIds = selectedIds.length >= 2 ? selectedIds : allAccounts.slice(0, 2).map((a) => a.id);
  const activeAccounts = activeIds.map((id) => allAccounts.find((a) => a.id === id)!).filter(Boolean);

  const range = ["7d", "30d", "90d", "custom"].includes(sp.range || "") ? sp.range! : "30d";
  const period = resolveComparePeriod(range, sp.from, sp.to);
  const metric = ["engagement", "followers", "reach", "rate"].includes(sp.metric || "") ? sp.metric! : "engagement";

  const stats = await computeBrandStats(activeIds, period.from, period.to);
  const dailySeries = await getBrandDailySeries(activeIds, period.from, period.to);
  const contentDaily = await getBrandContentDaily(activeIds, period.from, period.to);

  const brands = activeAccounts.map((a, i) => ({
    account: a,
    color: BRAND_COLORS[i % BRAND_COLORS.length],
    stats: stats.get(a.id)!,
  }));

  return (
    <div className="space-y-6">
      <div className="hidden print:block mb-4">
        <div>
          <div className="text-xs uppercase text-slate-500">SocmedInsight Comparison</div>
          <h1 className="text-2xl font-bold">Head-to-Head: {activeAccounts.map((a) => a.name).join(" vs ")}</h1>
          <div className="text-sm text-slate-600">Periode: {period.label} • Dicetak: {fmtDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandingkan Brand</h1>
          <p className="text-sm text-slate-500">Head-to-head performa side-by-side • {period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn-secondary">Kembali ke Dashboard</Link>
          <PrintButton />
        </div>
      </div>

      <CompareFilters
        allAccounts={allAccounts}
        selectedIds={activeIds}
        range={range}
        from={sp.from || ""}
        to={sp.to || ""}
        metric={metric}
      />

      <CompareTable brands={brands} />
      <CompareCharts
        brands={brands.map((b) => ({ id: b.account.id, name: b.account.name, color: b.color, platform: b.account.platform }))}
        dailySeries={dailySeries}
        contentDaily={contentDaily}
        metric={metric}
        period={period.label}
      />
    </div>
  );
}
