"use client";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAY_SHORT_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_LONG_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function shortPreview(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_SHORT_ID[dt.getDay()]}, ${d} ${MONTH_SHORT_ID[m - 1]} ${y}`;
}

function fullPreview(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Belum dipilih";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_LONG_ID[dt.getDay()]}, ${d} ${MONTH_LONG_ID[m - 1]} ${y}`;
}

/**
 * DateField — same footprint as plain <input>.
 * Indonesian preview shown as tiny inline text next to the label (same line,
 * smaller font — zero height impact). Full date on hover via title.
 * When there's no label, preview goes into tooltip only.
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
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const chip = shortPreview(value);
  const tooltip = fullPreview(value);

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className={cn("label", compact && "!text-xs")}>
          {label}
          {isValid && (
            <span
              className="ml-2 text-[10px] font-normal text-brand-600 tabular-nums"
              title={tooltip}
            >
              · {chip}
            </span>
          )}
        </label>
      )}
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
            "input !pl-9 cursor-pointer",
            isValid ? "text-slate-900 font-medium" : "text-slate-500",
            compact && "!py-1.5 !text-sm"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          max={max}
        />
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
