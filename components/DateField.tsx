"use client";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function formatIndoDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Belum dipilih";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES_ID[dt.getDay()]}, ${d} ${MONTH_NAMES_ID[m - 1]} ${y}`;
}

/**
 * Enhanced date input with:
 * - Icon prefix
 * - Live "dd MMMM yyyy" preview label below
 * - Explicit format hint
 * - Prominent styling
 *
 * Uses native <input type="date"> under the hood — accepts ISO YYYY-MM-DD.
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
  const preview = formatIndoDate(value);
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(value);

  return (
    <div className={cn("w-full", className)}>
      {label && <label className={cn("label", compact && "!text-xs")}>{label}</label>}
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
          className={cn(
            "input !pl-9 font-medium",
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
      <div className={cn(
        "mt-1 flex items-center gap-1.5 text-[11px]",
        isValid ? "text-brand-700" : "text-slate-400"
      )}>
        <span className={cn(
          "inline-block w-1.5 h-1.5 rounded-full",
          isValid ? "bg-brand-500" : "bg-slate-300"
        )} />
        <span className="font-medium">{preview}</span>
      </div>
      {hint && <div className="hint mt-0.5">{hint}</div>}
    </div>
  );
}
