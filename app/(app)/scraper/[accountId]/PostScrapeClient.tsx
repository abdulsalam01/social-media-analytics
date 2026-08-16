"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { togglePostScrape } from "../actions";

type PostRow = {
  id: number;
  post_date: string;
  title: string | null;
  link: string | null;
  shortcode: string | null;
  likes: number;
  comments: number;
  engagement_rate: number;
  scrape_enabled: number;
  updated_at: string;
};

type AccountRow = {
  id: number;
  name: string;
  handle: string;
  scrape_enabled: number;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
};

type LastLog = {
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

function LastScrapeStatus({ log }: { log: LastLog }) {
  const isError = log.status === "error";
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        isError ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"
      )}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn("text-sm font-semibold", isError ? "text-red-800" : "text-emerald-800")}>
              {isError ? "Scraping terakhir gagal" : "Scraping terakhir berhasil"}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {fmtRelative(log.scraped_at)} &middot;{" "}
              {new Date(log.scraped_at + "Z").toLocaleString("id-ID", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>

          {!isError && (
            <div className="mt-1 text-xs text-emerald-700">
              {log.posts_found} post ditemukan &middot; {log.posts_updated} post diperbarui
            </div>
          )}

          {isError && log.error && (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs font-medium text-red-700">Penyebab:</div>
              <div className="rounded-md bg-red-100 border border-red-200 px-3 py-2 font-mono text-xs text-red-800 break-all">
                {log.error}
              </div>
              {log.error.includes("HTTP 4") && (
                <p className="text-xs text-red-600">
                  Instagram memblokir request. Coba lagi nanti atau pastikan akun masih publik.
                </p>
              )}
              {log.error.includes("private") && (
                <p className="text-xs text-red-600">
                  Akun terdeteksi private — tidak bisa di-scrape tanpa sesi login.
                </p>
              )}
              {(log.error.includes("timeout") || log.error.includes("abort")) && (
                <p className="text-xs text-red-600">
                  Koneksi timeout. Periksa koneksi server lalu coba Scrape Sekarang.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostScrapeToggle({ postId, enabled }: { postId: number; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const next = !on;
      setOn(next);
      const res = await togglePostScrape(postId, next);
      if (!res.ok) setOn(!next);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={on ? "Nonaktifkan auto-update untuk post ini" : "Aktifkan auto-update"}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0",
        on ? "bg-brand-600" : "bg-slate-200",
        pending && "opacity-60 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-4.5" : "translate-x-0.5"
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
      className="btn-secondary flex items-center gap-2"
    >
      <RefreshCw className={cn("w-4 h-4", state === "loading" && "animate-spin")} />
      {state === "idle" && "Scrape Sekarang"}
      {state === "loading" && "Memproses..."}
      {state === "ok" && "Selesai!"}
      {state === "error" && "Gagal"}
    </button>
  );
}

export default function PostScrapeClient({
  account,
  posts,
  lastLog,
}: {
  account: AccountRow;
  posts: PostRow[];
  lastLog: LastLog | null;
}) {
  const enabledCount = posts.filter((p) => p.scrape_enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/scraper" className="hover:text-brand-600">Pelacak Otomatis</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{account.name}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
          <p className="text-sm text-slate-500">
            @{account.handle} · {enabledCount} dari {posts.length} post di-auto-scrape
          </p>
        </div>
        <div className="flex gap-2">
          {account.scrape_enabled === 1 && <ScrapeNowButton accountId={account.id} />}
          <Link href="/scraper" className="btn-ghost">← Kembali</Link>
        </div>
      </div>

      {lastLog && <LastScrapeStatus log={lastLog} />}

      {account.scrape_enabled === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Auto-scrape untuk akun ini dinonaktifkan. Aktifkan di halaman{" "}
          <Link href="/scraper" className="font-medium underline">Pelacak Otomatis</Link>.
        </div>
      )}

      <div className="card">
        <div className="card-bd p-0">
          {posts.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">
              Belum ada post ditemukan. Lakukan scrape pertama untuk menemukan post.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Judul / Caption</th>
                  <th className="px-5 py-3 text-right">Likes</th>
                  <th className="px-5 py-3 text-right">Komentar</th>
                  <th className="px-5 py-3 text-right">ER</th>
                  <th className="px-5 py-3">Update Terakhir</th>
                  <th className="px-5 py-3 text-center">Auto-Update</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{p.post_date}</td>
                    <td className="px-5 py-3 max-w-xs">
                      <div className="text-sm text-slate-900 truncate">
                        {p.title ?? <span className="text-slate-400 italic">Tanpa judul</span>}
                      </div>
                      {p.shortcode && (
                        <div className="text-xs text-slate-400 font-mono">{p.shortcode}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums">{p.likes.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums">{p.comments.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums">
                      {(p.engagement_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(p.updated_at + "Z").toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PostScrapeToggle postId={p.id} enabled={p.scrape_enabled === 1} />
                    </td>
                    <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                      <Link href={`/content/${p.id}`} className="btn-ghost !py-1 !px-2 text-xs">Detail</Link>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
