export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (x: Date) =>
    `${x.getUTCDate().toString().padStart(2, "0")}/${(x.getUTCMonth() + 1).toString().padStart(2, "0")}`;
  return `${fmt(d)} – ${fmt(end)}`;
}

/** YYYY-MM → { from: YYYY-MM-01, to: YYYY-MM-<last> } */
export function monthRange(monthYYYYMM: string): { from: string; to: string; label: string } {
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** last N months as [{value:'YYYY-MM', label:'Aug 2026'}] for a picker. */
export function recentMonths(n: number): { value: string; label: string }[] {
  const short = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${short[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return out;
}
