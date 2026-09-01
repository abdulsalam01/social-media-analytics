export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidISODate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftISODate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayInTimeZone(timeZone = "Asia/Jakarta", now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (x: Date) =>
    `${x.getUTCDate().toString().padStart(2, "0")}/${(x.getUTCMonth() + 1).toString().padStart(2, "0")}`;
  return `${fmt(d)} – ${fmt(end)}`;
}

/** YYYY-MM → { from: YYYY-MM-01, to: YYYY-MM-<last> } */
export function monthRange(monthYYYYMM: string): { from: string; to: string; label: string } {
  if (!MONTH_RE.test(monthYYYYMM)) throw new Error(`Format bulan tidak valid: ${monthYYYYMM}`);
  const [y, m] = monthYYYYMM.split("-").map((x) => parseInt(x));
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return { from: iso(first), to: iso(last), label: `${monthNames[m - 1]} ${y}` };
}

export function currentMonth(): string {
  return todayInTimeZone().slice(0, 7);
}

export type DashboardRange = "7d" | "30d" | "90d" | "month" | "custom";
export type DashboardPeriod = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
};

/** Resolve the dashboard filter and its immediately preceding comparison period. */
export function resolveDashboardPeriod(
  range: DashboardRange,
  customFrom?: string,
  customTo?: string,
  month?: string,
  today = todayInTimeZone()
): DashboardPeriod {
  if (!isValidISODate(today)) throw new Error(`Tanggal acuan tidak valid: ${today}`);

  if (range === "month") {
    const key = month && MONTH_RE.test(month) ? month : today.slice(0, 7);
    const current = monthRange(key);
    const [year, monthNumber] = key.split("-").map(Number);
    const previousDate = new Date(Date.UTC(year, monthNumber - 2, 1));
    const previousKey = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const previous = monthRange(previousKey);
    return {
      from: current.from,
      to: current.to,
      prevFrom: previous.from,
      prevTo: previous.to,
      label: `Bulan ${current.label}`,
    };
  }

  let from: string;
  let to: string;
  let label: string;
  if (range === "custom" && isValidISODate(customFrom) && isValidISODate(customTo) && customFrom <= customTo) {
    from = customFrom;
    to = customTo;
    label = `${from} → ${to}`;
  } else {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    from = shiftISODate(today, -(days - 1));
    to = today;
    label = `${days} hari terakhir`;
  }

  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const prevTo = shiftISODate(from, -1);
  return {
    from,
    to,
    prevFrom: shiftISODate(prevTo, -(days - 1)),
    prevTo,
    label,
  };
}

/** last N months as [{value:'YYYY-MM', label:'Aug 2026'}] for a picker. */
export function recentMonths(n: number): { value: string; label: string }[] {
  const short = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [year, month] = currentMonth().split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    out.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${short[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    });
  }
  return out;
}

/**
 * Symmetric month window: `before` months before current + current + `after` months after.
 * Ordered oldest-first so newest appears at bottom of dropdown.
 */
export function monthWindow(before: number, after: number): { value: string; label: string }[] {
  const short = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [year, month] = currentMonth().split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    out.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${short[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    });
  }
  return out;
}
