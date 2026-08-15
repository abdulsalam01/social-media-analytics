import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Heart, MessageCircle, Share2, Bookmark, Eye, Play, TrendingUp, Users, Zap, Calendar, Clock, RefreshCw } from "lucide-react";
import { dbGet, Account, ContentInsight } from "@/lib/db";
import { fmtNum, fmtPct, fmtDate, fmtDateTime, fmtRelative } from "@/lib/utils";
import PlatformBadge from "@/components/PlatformBadge";
import DetailActions from "./DetailActions";

export const dynamic = "force-dynamic";

function normalizeLink(link: string | null, platform: "instagram" | "tiktok"): string | null {
  if (!link) return null;
  const t = link.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (platform === "instagram" && !t.includes(" ")) return `https://www.instagram.com/p/${t.replace(/^\/+/, "")}`;
  if (platform === "tiktok" && !t.includes(" ")) return `https://www.tiktok.com/${t.replace(/^\/+/, "")}`;
  return t;
}

export default async function ContentDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const idNum = parseInt(id);
  if (!Number.isFinite(idNum)) notFound();

  const content = await dbGet<ContentInsight>("SELECT * FROM content_insight WHERE id = ?", [idNum]);
  if (!content) notFound();

  const account = await dbGet<Account>("SELECT * FROM accounts WHERE id = ?", [content.account_id]);
  if (!account) notFound();

  const isTT = account.platform === "tiktok";
  const externalUrl = normalizeLink(content.link, account.platform);

  const rank = (await dbGet<{ rk: number }>(
    `SELECT COUNT(*) + 1 AS rk FROM content_insight
     WHERE account_id = ? AND (engagement > ? OR (engagement = ? AND id < ?))`,
    [account.id, content.engagement, content.engagement, content.id]
  ))?.rk ?? 1;

  const totalPosts = (await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM content_insight WHERE account_id = ?",
    [account.id]
  ))?.c ?? 0;

  const backHref = from && from.startsWith("/") && !from.startsWith("//") ? from : `/dashboard?account=${account.id}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm">
        <Link href={backHref} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-brand-600 to-brand-400 text-white">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider opacity-80">Detail Konten</div>
              <h1 className="text-2xl font-bold mt-1 break-words">
                {content.title || <span className="italic opacity-80">Tanpa Judul</span>}
              </h1>
              <div className="mt-2 flex items-center gap-3 text-sm opacity-90 flex-wrap">
                <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {fmtDate(content.post_date)}</span>
                <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> {account.name} (@{account.handle})</span>
                <PlatformBadge platform={account.platform} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs opacity-75">Ranking Engagement</div>
              <div className="text-2xl font-bold">#{fmtNum(rank)} <span className="text-sm opacity-75">/ {fmtNum(totalPosts)}</span></div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {externalUrl ? (
              <a href={externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white text-brand-700 hover:bg-brand-50 rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
                <ExternalLink className="w-4 h-4" /> Buka Post Asli di {isTT ? "TikTok" : "Instagram"}
              </a>
            ) : (
              <div className="text-xs opacity-80 italic">Link post asli belum diisi</div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricBlock icon={<Zap className="w-4 h-4" />} label="Engagement" value={fmtNum(content.engagement)} tone="brand" />
            <MetricBlock icon={<TrendingUp className="w-4 h-4" />} label="Engagement Rate" value={fmtPct(content.engagement_rate)} tone="green" />
            <MetricBlock icon={<Heart className="w-4 h-4" />} label="Likes" value={fmtNum(content.likes)} tone="pink" />
            <MetricBlock icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={fmtNum(content.comments)} tone="brand" />
            <MetricBlock icon={<Share2 className="w-4 h-4" />} label="Shares" value={fmtNum(content.shares)} tone="green" />
            <MetricBlock icon={<Bookmark className="w-4 h-4" />} label="Saves" value={fmtNum(content.saves)} tone="amber" />
            {isTT ? (
              <MetricBlock icon={<Play className="w-4 h-4" />} label="Video Plays" value={fmtNum(content.plays)} tone="pink" />
            ) : (
              <>
                <MetricBlock icon={<Eye className="w-4 h-4" />} label="Reach" value={fmtNum(content.reach)} tone="amber" />
                <MetricBlock icon={<Eye className="w-4 h-4" />} label="Impression" value={fmtNum(content.impression)} tone="brand" />
              </>
            )}
            {!isTT && (
              <>
                <MetricBlock icon={<Users className="w-4 h-4" />} label="Profile Visit" value={fmtNum(content.profile_visit)} tone="green" />
                <MetricBlock icon={<Users className="w-4 h-4" />} label="Follow Baru" value={fmtNum(content.follows)} tone="pink" />
              </>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase text-slate-500">Tanggal Post</div>
              <div className="mt-1 text-sm text-slate-800">{fmtDate(content.post_date)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Link Post</div>
              <div className="mt-1 text-sm">
                {externalUrl ? (
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{externalUrl}</a>
                ) : (
                  <span className="text-slate-400 italic">Belum diisi</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Ditambahkan</div>
              <div className="mt-1 text-sm text-slate-800" title={fmtDateTime(content.created_at)}>
                {fmtDateTime(content.created_at)} <span className="text-xs text-slate-400">({fmtRelative(content.created_at)})</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Terakhir Diubah</div>
              <div className="mt-1 text-sm text-slate-800" title={fmtDateTime(content.updated_at)}>
                {content.updated_at !== content.created_at ? (
                  <>{fmtDateTime(content.updated_at)} <span className="text-xs text-slate-400">({fmtRelative(content.updated_at)})</span></>
                ) : (
                  <span className="text-slate-400 italic">Belum pernah diedit</span>
                )}
              </div>
            </div>
          </div>

          <DetailActions
            content={content}
            account={account}
            backHref={backHref}
          />
        </div>
      </div>
    </div>
  );
}

function MetricBlock({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "green" | "pink" | "amber" }) {
  const toneMap = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", pink: "bg-pink-50 text-pink-600", amber: "bg-amber-50 text-amber-600" } as const;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg grid place-items-center ${toneMap[tone]}`}>{icon}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
