"use client";
import Link from "next/link";
import { ExternalLink, Heart, MessageCircle, Share2, Bookmark, Eye, Play, Award, TrendingUp, ArrowRight } from "lucide-react";
import { fmtNum, fmtPct, fmtDate, cn } from "@/lib/utils";
import type { Platform } from "@/lib/db";

type Post = {
  id: number;
  post_date: string;
  title: string | null;
  link: string | null;
  engagement: number;
  reach: number;
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  impression: number;
  profile_visit: number;
};

const SORT_META: Record<string, { label: string; suffix?: string; fmt: "num" | "pct" }> = {
  engagement: { label: "Engagement", fmt: "num" },
  reach: { label: "Reach / Plays", fmt: "num" },
  likes: { label: "Like", fmt: "num" },
  comments: { label: "Comment", fmt: "num" },
  shares: { label: "Share", fmt: "num" },
  saves: { label: "Save", fmt: "num" },
  rate: { label: "Engagement Rate", fmt: "pct" },
  date: { label: "Tanggal Post", fmt: "num" },
};

function getSortValue(p: Post, sortBy: string, isTT: boolean): number {
  switch (sortBy) {
    case "reach": return isTT ? p.plays : p.reach;
    case "likes": return p.likes;
    case "comments": return p.comments;
    case "shares": return p.shares;
    case "saves": return p.saves;
    case "rate": return p.engagement_rate;
    case "date": return new Date(p.post_date).getTime();
    default: return p.engagement;
  }
}

function normalizeLink(link: string | null, platform: Platform): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (platform === "instagram" && !trimmed.includes(" ")) return `https://www.instagram.com/p/${trimmed.replace(/^\/+/, "")}`;
  if (platform === "tiktok" && !trimmed.includes(" ")) return `https://www.tiktok.com/${trimmed.replace(/^\/+/, "")}`;
  return trimmed;
}

export default function TopPostsList({
  posts, platform, sortBy, rangeLabel, backHref,
}: {
  posts: Post[];
  platform: Platform;
  sortBy: string;
  rangeLabel: string;
  backHref: string;
}) {
  const isTT = platform === "tiktok";
  const sortMeta = SORT_META[sortBy] || SORT_META.engagement;

  if (posts.length === 0) {
    return (
      <div className="card">
        <div className="card-hd">
          <div>
            <div className="font-semibold text-slate-900">Top Konten (Klik untuk Buka)</div>
            <div className="text-xs text-slate-500">Belum ada konten yang cocok filter.</div>
          </div>
        </div>
        <div className="card-bd text-center py-8 text-sm text-slate-400">
          Tidak ada konten pada rentang ini.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Top {posts.length} Konten
          </div>
          <div className="text-xs text-slate-500">Diurut: {sortMeta.label} • {rangeLabel} • Klik untuk lihat detail lengkap</div>
        </div>
      </div>
      <div className="card-bd p-0">
        <div className="divide-y divide-slate-100">
          {posts.map((p, i) => {
            const rank = i + 1;
            const url = normalizeLink(p.link, platform);
            const sortValue = getSortValue(p, sortBy, isTT);
            const detailHref = `/content/${p.id}?from=${encodeURIComponent(backHref)}`;
            return (
              <Link
                key={p.id}
                href={detailHref}
                className="block p-4 hover:bg-brand-50/40 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-lg grid place-items-center text-xs font-bold shrink-0",
                    rank === 1 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" :
                    rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
                    rank === 3 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    #{rank}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        {p.title ? (
                          <div className="text-sm font-semibold text-slate-900 mb-0.5 group-hover:text-brand-700" title={p.title}>{p.title}</div>
                        ) : (
                          <div className="text-sm font-semibold text-slate-500 italic mb-0.5 group-hover:text-brand-700">Tanpa Judul</div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="text-xs text-slate-500">Post pada {fmtDate(p.post_date)}</div>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                            >
                              Buka post asli <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <div className="text-xs text-slate-500">{sortMeta.label}</div>
                          <div className="text-lg font-bold text-slate-900">
                            {sortMeta.fmt === "pct" ? fmtPct(sortValue) : fmtNum(sortValue)}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-slate-600">
                      <Stat icon={<Heart className="w-3.5 h-3.5 text-pink-500" />} value={p.likes} label="Like" />
                      <Stat icon={<MessageCircle className="w-3.5 h-3.5 text-blue-500" />} value={p.comments} label="Comment" />
                      <Stat icon={<Share2 className="w-3.5 h-3.5 text-emerald-500" />} value={p.shares} label="Share" />
                      <Stat icon={<Bookmark className="w-3.5 h-3.5 text-amber-500" />} value={p.saves} label="Save" />
                      {isTT ? (
                        <Stat icon={<Play className="w-3.5 h-3.5 text-slate-500" />} value={p.plays} label="Plays" />
                      ) : (
                        <Stat icon={<Eye className="w-3.5 h-3.5 text-slate-500" />} value={p.reach} label="Reach" />
                      )}
                      <Stat icon={<TrendingUp className="w-3.5 h-3.5 text-brand-500" />} value={p.engagement_rate} label="ER" isPct />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, isPct }: { icon: React.ReactNode; value: number; label: string; isPct?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {icon}
      <span className="font-semibold text-slate-900">{isPct ? fmtPct(value) : fmtNum(value)}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
