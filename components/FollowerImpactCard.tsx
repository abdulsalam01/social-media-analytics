import Link from "next/link";
import { ArrowRight, Flag, Pencil, TrendingDown, TrendingUp, Users } from "lucide-react";
import { calculateFollowerImpact } from "@/lib/follower-impact";
import { cn, fmtNum, fmtPct } from "@/lib/utils";

export default function FollowerImpactCard({
  accountId,
  initialFollowers,
  currentFollowers,
  periodLabel,
  canEdit,
}: {
  accountId: number;
  initialFollowers: number;
  currentFollowers: number | null;
  periodLabel: string;
  canEdit: boolean;
}) {
  const impact = calculateFollowerImpact(initialFollowers, currentFollowers);
  if (!impact.enabled) return null;
  const positive = impact.impact >= 0;

  return (
    <section className="card overflow-hidden" aria-label="Dampak follower sejak baseline">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50 via-white to-emerald-50/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Dampak Sejak Mulai Dikelola</h2>
              <p className="mt-0.5 text-xs text-slate-500">Baseline dibandingkan dengan snapshot terakhir hingga {periodLabel}.</p>
            </div>
          </div>
          {canEdit && (
            <Link href={`/accounts/${accountId}/edit`} className="btn-ghost no-print !px-2.5 !py-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Edit baseline
            </Link>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch md:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
        <ImpactValue icon={<Flag className="h-4 w-4" />} label="Initial Followers" value={fmtNum(impact.initialFollowers)} />
        <div className="hidden place-items-center text-slate-300 md:grid"><ArrowRight className="h-5 w-5" /></div>
        <ImpactValue icon={<Users className="h-4 w-4" />} label="Followers Akhir Periode" value={fmtNum(impact.currentFollowers)} />
        <div className="hidden place-items-center text-slate-300 md:grid"><ArrowRight className="h-5 w-5" /></div>
        <div className={cn("p-5 md:p-6", positive ? "bg-emerald-50/60" : "bg-red-50/60")}>
          <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", positive ? "text-emerald-700" : "text-red-700")}>
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            Dampak Follower
          </div>
          <div className={cn("mt-2 text-3xl font-bold tabular-nums", positive ? "text-emerald-700" : "text-red-700")}>
            {impact.impact > 0 ? "+" : ""}{fmtNum(impact.impact)}
          </div>
          <div className={cn("mt-1 text-sm font-medium", positive ? "text-emerald-700" : "text-red-700")}>
            {impact.impactRate !== null && `${impact.impactRate > 0 ? "+" : ""}${fmtPct(impact.impactRate)} dari baseline`}
          </div>
        </div>
      </div>
    </section>
  );
}

function ImpactValue({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 p-5 md:border-b-0 md:p-6">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
