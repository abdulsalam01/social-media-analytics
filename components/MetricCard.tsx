import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  suffix,
  hint,
  delta,
  icon,
  tone = "brand",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  delta?: number;
  icon?: ReactNode;
  tone?: "brand" | "green" | "pink" | "amber";
}) {
  const toneMap = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    pink: "bg-pink-50 text-pink-600",
    amber: "bg-amber-50 text-amber-600",
  } as const;

  const trend =
    delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="card">
      <div className="card-bd">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {typeof value === "number" ? fmtNum(value) : value}
              {suffix && <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span>}
            </div>
            {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
          </div>
          {icon && (
            <div className={cn("w-10 h-10 rounded-xl grid place-items-center", toneMap[tone])}>
              {icon}
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            {trend === "up" && (
              <span className="badge-green">
                <TrendingUp className="w-3 h-3" /> +{fmtNum(Math.abs(delta!))}
              </span>
            )}
            {trend === "down" && (
              <span className="badge-red">
                <TrendingDown className="w-3 h-3" /> −{fmtNum(Math.abs(delta!))}
              </span>
            )}
            {trend === "flat" && (
              <span className="badge-slate">
                <Minus className="w-3 h-3" /> Tidak berubah
              </span>
            )}
            <span className="text-slate-400">vs minggu lalu</span>
          </div>
        )}
      </div>
    </div>
  );
}
