"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, ExternalLink, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toggleAccountScrape, getScrapeLogs } from "./actions";

type AccountRow = {
  id: number;
  name: string;
  handle: string;
  platform: string;
  scrape_enabled: number;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  tracked_posts: number;
};

type LogRow = {
  id: number;
  scraped_at: string;
  status: string;
  posts_found: number;
  posts_updated: number;
  error: string | null;
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso + "Z").getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function ScrapeToggle({ accountId, enabled }: { accountId: number; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const next = !on;
      setOn(next);
      const res = await toggleAccountScrape(accountId, next);
      if (!res.ok) setOn(!next);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        on ? "bg-brand-600" : "bg-slate-200",
        pending && "opacity-60 cursor-not-allowed"
      )}
      aria-label={on ? "Nonaktifkan scraping" : "Aktifkan scraping"}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function ScrapeNowButton({ accountId }: { accountId: number }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const router = useRouter();

  async function trigger() {
    setState("loading");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const json = await res.json();
      setState(json.ok ? "ok" : "error");
      router.refresh();
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <button
      onClick={trigger}
      disabled={state === "loading"}
      className={cn(
        "btn-secondary !py-1 !px-2 text-xs flex items-center gap-1",
        state === "ok" && "!text-emerald-600",
        state === "error" && "!text-red-600"
      )}
    >
      <RefreshCw className={cn("w-3 h-3", state === "loading" && "animate-spin")} />
      {state === "idle" && "Scrape"}
      {state === "loading" && "Proses..."}
      {state === "ok" && "Selesai!"}
      {state === "error" && "Gagal"}
    </button>
  );
}

function ScrapeAllButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [summary, setSummary] = useState<{ total: number; failed: number } | null>(null);
  const router = useRouter();

  async function trigger() {
    setState("loading");
    setSummary(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setSummary({ total: json.total ?? 0, failed: json.failed ?? 0 });
      setState(json.failed === 0 ? "ok" : "error");
      router.refresh();
    } catch {
      setState("error");
    }
    setTimeout(() => { setState("idle"); setSummary(null); }, 5000);
  }

  return (
    <div className="flex items-center gap-3">
      {summary && state === "error" && (
        <span className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {summary.failed} dari {summary.total} akun gagal
        </span>
      )}
      {summary && state === "ok" && (
        <span className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {summary.total} akun selesai
        </span>
      )}
      <button
        onClick={trigger}
        disabled={state === "loading"}
        className="btn-primary flex items-center gap-2"
      >
        <RefreshCw className={cn("w-4 h-4", state === "loading" && "animate-spin")} />
        {state === "idle" && "Scrape Semua"}
        {state === "loading" && "Memproses..."}
        {(state === "ok" || state === "error") && "Selesai"}
      </button>
    </div>
  );
}

function ScrapeLogPanel({ accountId }: { accountId: number }) {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (logs !== null) return;
    setLoading(true);
    const data = await getScrapeLogs(accountId);
    setLogs(data as LogRow[]);
    setLoading(false);
  }

  // Auto-load on mount
  if (logs === null && !loading) load();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500">
        <RefreshCw className="w-3 h-3 animate-spin" /> Memuat log...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-slate-400 italic">
        Belum ada riwayat scraping untuk akun ini.
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Riwayat Scraping (10 terakhir)
      </div>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn(
              "rounded-lg border px-4 py-3",
              log.status === "ok"
                ? "bg-emerald-50 border-emerald-100"
                : "bg-red-50 border-red-200"
            )}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {log.status === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  log.status === "ok" ? "text-emerald-800" : "text-red-800"
                )}>
                  {log.status === "ok" ? "Berhasil" : "Gagal"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span title={log.scraped_at}>{fmtRelative(log.scraped_at)}</span>
                <span className="text-slate-300 mx-1">·</span>
                <span>{new Date(log.scraped_at + "Z").toLocaleString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit"
                })}</span>
              </div>
            </div>

            {log.status === "ok" && (
              <div className="mt-2 flex items-center gap-4 text-xs text-emerald-700">
                <span>{log.posts_found} post ditemukan</span>
                <span className="text-emerald-300">·</span>
                <span>{log.posts_updated} post diperbarui</span>
              </div>
            )}

            {log.status === "error" && log.error && (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-medium text-red-700">Penyebab error:</div>
                <div className="rounded-md bg-red-100 border border-red-200 px-3 py-2 font-mono text-xs text-red-800 break-all">
                  {log.error}
                </div>
                {log.error.includes("HTTP 4") && (
                  <div className="text-xs text-red-600 mt-1">
                    Instagram memblokir request ini. Coba lagi nanti atau periksa apakah akun masih publik.
                  </div>
                )}
                {log.error.includes("private") && (
                  <div className="text-xs text-red-600 mt-1">
                    Akun ini terdeteksi sebagai private — tidak bisa di-scrape.
                  </div>
                )}
                {(log.error.includes("timeout") || log.error.includes("abort")) && (
                  <div className="text-xs text-red-600 mt-1">
                    Koneksi timeout. Periksa koneksi server atau coba lagi.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountRow({ a }: { a: AccountRow }) {
  const [showLog, setShowLog] = useState(false);
  const hasError = a.last_scrape_status === "error";

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
          showLog && "bg-slate-50/70"
        )}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
              a.platform === "instagram"
                ? "bg-pink-100 text-pink-700"
                : "bg-slate-900 text-white"
            )}>
              {a.platform === "instagram" ? "IG" : "TT"}
            </span>
            <div className="font-medium text-slate-900">{a.name}</div>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 ml-8">
            @{a.handle}
            <a
              href={
                a.platform === "instagram"
                  ? `https://www.instagram.com/${a.handle}/`
                  : `https://www.tiktok.com/@${a.handle}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-brand-600"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </td>
        <td className="px-5 py-4">
          <ScrapeToggle accountId={a.id} enabled={a.scrape_enabled === 1} />
        </td>
        <td className="px-5 py-4 text-slate-600 text-sm">{a.tracked_posts ?? 0}</td>
        <td className="px-5 py-4 text-slate-500 text-sm whitespace-nowrap">
          {a.last_scraped_at ? fmtRelative(a.last_scraped_at) : "—"}
        </td>
        <td className="px-5 py-4">
          <button
            onClick={() => setShowLog((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-colors",
              !a.last_scrape_status && "text-slate-400 border-transparent",
              a.last_scrape_status === "ok" &&
                "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
              hasError &&
                "text-red-700 bg-red-50 border-red-200 hover:bg-red-100 font-medium"
            )}
          >
            {!a.last_scrape_status && <span>Belum pernah</span>}
            {a.last_scrape_status === "ok" && (
              <><CheckCircle2 className="w-3 h-3" /> Berhasil</>
            )}
            {hasError && (
              <><XCircle className="w-3 h-3" /> Error — lihat log</>
            )}
            {a.last_scrape_status && (
              <ChevronDown className={cn("w-3 h-3 transition-transform", showLog && "rotate-180")} />
            )}
          </button>
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {a.scrape_enabled === 1 && <ScrapeNowButton accountId={a.id} />}
            <Link
              href={`/scraper/${a.id}`}
              className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1"
            >
              Post <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </td>
      </tr>

      {showLog && (
        <tr className="border-b border-slate-100 bg-slate-50/40">
          <td colSpan={6} className="p-0">
            <ScrapeLogPanel accountId={a.id} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function ScraperClient({ accounts }: { accounts: AccountRow[] }) {
  const activeCount = accounts.filter((a) => a.scrape_enabled).length;
  const trackedPosts = accounts.reduce((s, a) => s + (a.tracked_posts ?? 0), 0);
  const errorCount = accounts.filter((a) => a.last_scrape_status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pelacak Otomatis</h1>
          <p className="text-sm text-slate-500">
            Scraping harian Instagram &amp; TikTok — follower, likes, komentar, plays.
          </p>
        </div>
        <ScrapeAllButton />
      </div>

      {errorCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-800">
              {errorCount} akun mengalami error pada scraping terakhir
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              Klik badge <span className="font-semibold">Error — lihat log</span> di tabel untuk melihat detail penyebabnya.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card"><div className="card-bd">
          <div className="text-xs text-slate-500">Akun Aktif Scraping</div>
          <div className="text-2xl font-bold mt-1">{activeCount} / {accounts.length}</div>
        </div></div>
        <div className="card"><div className="card-bd">
          <div className="text-xs text-slate-500">Post Dilacak</div>
          <div className="text-2xl font-bold mt-1">{trackedPosts}</div>
        </div></div>
        <div className="card"><div className="card-bd">
          <div className="text-xs text-slate-500">Jadwal Otomatis</div>
          <div className="text-sm font-medium mt-1 text-slate-600">Setiap hari pukul 06:00 UTC</div>
        </div></div>
      </div>

      <div className="card">
        <div className="card-bd p-0">
          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">
              Belum ada akun Instagram.{" "}
              <Link href="/accounts/new" className="text-brand-600 hover:underline">Tambah akun dulu.</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3">Akun</th>
                  <th className="px-5 py-3">Auto-Scrape</th>
                  <th className="px-5 py-3">Post</th>
                  <th className="px-5 py-3">Terakhir</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => <AccountRow key={a.id} a={a} />)}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card bg-amber-50 border-amber-200">
        <div className="card-bd">
          <div className="text-sm font-medium text-amber-800 mb-2">Catatan Scraper</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-pink-700 mb-1">Instagram</div>
              <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                <li>Data: follower, likes, komentar, caption.</li>
                <li>Saves, reach, impression, plays — isi manual.</li>
                <li>Instagram bisa blokir request — error tercatat di log.</li>
                <li>Akun private tidak bisa di-scrape.</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-1">TikTok</div>
              <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                <li>Data: follower, likes, komentar, plays, shares, caption.</li>
                <li>Saves, reach, impression — isi manual.</li>
                <li>TikTok pakai Cloudflare — scraping dari server bisa gagal.</li>
                <li>Akun private tidak bisa di-scrape.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
