import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  if (opts?.compact) {
    return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  // SQLite datetime('now') = "YYYY-MM-DD HH:MM:SS" (UTC, no tz). Treat as UTC.
  const withTz = iso.includes("T") ? iso : iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z");
  const d = new Date(withTz);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtRelative(iso: string): string {
  const withTz = iso.includes("T") ? iso : iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z");
  const d = new Date(withTz);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy} hari lalu`;
  return fmtDateTime(iso);
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
