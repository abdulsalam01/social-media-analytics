"use client";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAY_SHORT_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function chipPreview(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_SHORT_ID[dt.getDay()]}, ${d} ${MONTH_SHORT_ID[m - 1]} ${String(y).slice(2)}`;
}

function fullPreview(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Belum dipilih";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_LONG_ID[m - 1]} ${y}`;
}

/**
 * Compact date input — Indonesian preview sits INLINE next to the label,
 * so component height matches sibling text/number inputs in a grid row.
 * Full ID date shown as tooltip on hover.
 */
export default function DateField({
  label,
  value,
  onChange,
  required,
  hint,
  min,
  max,
  compact,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  min?: string;
  max?: string;
  compact?: boolean;
  className?: string;
}) {
  const chip = chipPreview(value);
  const isValid = chip !== "";
  const tooltip = fullPreview(value);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {label ? (
          <label className={cn("label !mb-0", compact && "!text-xs")}>{label}</label>
        ) : <span className="text-sm">&nbsp;</span>}
        {isValid && (
          <span
            title={tooltip}
            className={cn(
              "rounded bg-brand-50 text-brand-700 border border-brand-100 font-medium tabular-nums leading-tight",
              compact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"
            )}
          >
            {chip}
          </span>
        )}
      </div>
      <div className="relative">
        <Calendar
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none",
            compact ? "w-3.5 h-3.5" : "w-4 h-4",
            isValid ? "text-brand-500" : "text-slate-400"
          )}
        />
        <input
          type="date"
          title={tooltip}
          className={cn(
            "input !pl-9 font-medium cursor-pointer",
            isValid ? "text-slate-900" : "text-slate-500",
            compact && "!py-1.5 !text-sm"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          max={max}
        />
      </div>
      {hint && <div className="hint mt-0.5">{hint}</div>}
    </div>
  );
}
