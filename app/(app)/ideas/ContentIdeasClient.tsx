"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CalendarClock, ChevronDown, Clock3, Database,
  ExternalLink, Lightbulb, Link2, Loader2, Save, Search, Target,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import type { Account, ContentGoal, ContentIdea, ContentIdeaStatus, ContentIdeaType, TrendEvidence } from "@/lib/db";
import type { ProviderReport } from "@/lib/trends";
import { generateContentIdeas, saveContentGoals, updateIdeaStatus } from "./actions";

export type GoalFormData = {
  primaryGoal: ContentGoal;
  targetAudience: string;
  brandVoice: string;
  contentPillars: string[];
  keywords: string[];
  preferredFormats: ContentIdeaType[];
  preferredDays: number[];
  audienceActiveHours: string[];
  postsPerWeek: number;
  timezone: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
  additionalContext: string;
  configured: boolean;
};

export type ResearchRunDto = {
  id: number;
  status: string;
  provider_summary: string;
  evidence_count: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

const GOALS: Array<{ value: ContentGoal; label: string; description: string }> = [
  { value: "growth", label: "Growth follower", description: "Menambah audiens relevan" },
  { value: "engagement", label: "Engagement", description: "Komentar, save, share" },
  { value: "reach", label: "Reach", description: "Menjangkau lebih banyak orang" },
  { value: "awareness", label: "Brand awareness", description: "Membangun ingatan brand" },
  { value: "leads", label: "Leads", description: "Mendorong prospek masuk" },
  { value: "sales", label: "Sales", description: "Mendorong tindakan pembelian" },
];

const FORMAT_LABELS: Record<ContentIdeaType, string> = {
  carousel: "Carousel",
  video: "Video",
  kombinasi: "Kombinasi",
};

const STATUS_LABELS: Record<ContentIdeaStatus, string> = {
  ide: "Ide",
  dikembangkan: "Dikembangkan",
  siap: "Siap produksi",
  terjadwal: "Terjadwal",
  terbit: "Sudah terbit",
  diarsipkan: "Diarsipkan",
};

const STATUS_CLASSES: Record<ContentIdeaStatus, string> = {
  ide: "bg-violet-50 text-violet-700 border-violet-200",
  dikembangkan: "bg-amber-50 text-amber-700 border-amber-200",
  siap: "bg-blue-50 text-blue-700 border-blue-200",
  terjadwal: "bg-cyan-50 text-cyan-700 border-cyan-200",
  terbit: "bg-emerald-50 text-emerald-700 border-emerald-200",
  diarsipkan: "bg-slate-100 text-slate-600 border-slate-200",
};

const VOICE_OPTIONS = [
  "Informatif, hangat, jelas, dan tidak berlebihan",
  "Santai, akrab, ringan, dan relevan",
  "Profesional, tegas, terpercaya, dan ringkas",
  "Persuasif, energik, berorientasi tindakan, tanpa clickbait",
];

function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function formatDateTime(value: string | null, timezone = "Asia/Jakarta"): string {
  if (!value) return "Belum dijadwalkan";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function providerReports(run: ResearchRunDto | null): ProviderReport[] {
  if (!run) return [];
  try {
    const parsed = JSON.parse(run.provider_summary);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function GoalSettings({ accountId, initial, canEdit, onKeywordsSaved }: {
  accountId: number;
  initial: GoalFormData;
  canEdit: boolean;
  onKeywordsSaved: (keywords: string[]) => void;
}) {
  const [open, setOpen] = useState(!initial.configured);
  const [goal, setGoal] = useState(initial);
  const [topics, setTopics] = useState((initial.keywords.length ? initial.keywords : initial.contentPillars).join(", "));
  const [pending, start] = useTransition();
  const toast = useToast();

  function save() {
    start(async () => {
      const topicList = splitTags(topics);
      const result = await saveContentGoals({
        accountId,
        primaryGoal: goal.primaryGoal,
        targetAudience: goal.targetAudience,
        brandVoice: goal.brandVoice,
        contentPillars: topicList,
        keywords: topicList,
        preferredFormats: [goal.preferredFormats[0] ?? "video"],
        preferredDays: goal.preferredDays,
        audienceActiveHours: goal.audienceActiveHours[0] ? [goal.audienceActiveHours[0]] : [],
        postsPerWeek: goal.postsPerWeek,
        timezone: goal.timezone,
        additionalContext: goal.additionalContext || null,
      });
      if (!result.ok) return toast("error", result.error);
      setGoal((current) => ({ ...current, configured: true }));
      onKeywordsSaved(topicList);
      toast("success", "Account Goals berhasil disimpan.");
      setOpen(false);
    });
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((value) => !value)} className="card-hd w-full text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 grid place-items-center"><Target className="w-4 h-4 text-violet-600" /></div>
          <div>
            <div className="font-semibold text-slate-900">1. Account Goals</div>
            <div className="text-xs text-slate-500">Fondasi agar AI tidak membuat ide generik.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={initial.configured || goal.configured ? "badge-green" : "badge-red"}>{initial.configured || goal.configured ? "Tersimpan" : "Wajib diisi"}</span>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="card-bd space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Goal utama</label>
              <select className="input" disabled={!canEdit} value={goal.primaryGoal} onChange={(event) => setGoal((current) => ({ ...current, primaryGoal: event.target.value as ContentGoal }))}>
                {GOALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Format utama</label>
              <select className="input" disabled={!canEdit} value={goal.preferredFormats[0] ?? "video"} onChange={(event) => setGoal((current) => ({ ...current, preferredFormats: [event.target.value as ContentIdeaType] }))}>
                {(Object.keys(FORMAT_LABELS) as ContentIdeaType[]).map((format) => <option key={format} value={format}>{FORMAT_LABELS[format]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Target audiens</label>
            <input className="input" disabled={!canEdit} value={goal.targetAudience} onChange={(event) => setGoal((current) => ({ ...current, targetAudience: event.target.value }))} placeholder="Contoh: Pemilik UMKM kuliner usia 25–40 di kota besar" />
          </div>

          <div>
            <label className="label">Topik & keyword utama</label>
            <input className="input" disabled={!canEdit} value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="UMKM, pemasaran digital, Instagram Reels" />
            <div className="hint">Pisahkan dengan koma. Dipakai sekaligus sebagai pilar konten dan keyword riset.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Gaya bahasa</label>
              <select className="input" disabled={!canEdit} value={goal.brandVoice} onChange={(event) => setGoal((current) => ({ ...current, brandVoice: event.target.value }))}>
                {!VOICE_OPTIONS.includes(goal.brandVoice) && <option value={goal.brandVoice}>{goal.brandVoice}</option>}
                {VOICE_OPTIONS.map((voice) => <option key={voice} value={voice}>{voice.split(",")[0]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Post / minggu</label>
              <input type="number" min={1} max={14} className="input" disabled={!canEdit} value={goal.postsPerWeek} onChange={(event) => setGoal((current) => ({ ...current, postsPerWeek: Number(event.target.value) }))} />
            </div>
            <div>
              <label className="label">Jam aktif utama <span className="font-normal text-slate-400">(opsional)</span></label>
              <input type="time" className="input" disabled={!canEdit} value={goal.audienceActiveHours[0] ?? ""} onChange={(event) => setGoal((current) => ({ ...current, audienceActiveHours: event.target.value ? [event.target.value] : [] }))} />
              <div className="hint">Ambil dari Insights akun.</div>
            </div>
          </div>

          {canEdit && <button type="button" onClick={save} disabled={pending || splitTags(topics).length === 0} className="btn-primary"><Save className="w-4 h-4" /> {pending ? "Menyimpan…" : "Simpan Goals"}</button>}
        </div>
      )}
    </div>
  );
}

function ResearchPanel({ accountId, configured, defaultKeywords, canEdit, latestRun, onKeywordsChange }: {
  accountId: number;
  configured: boolean;
  defaultKeywords: string[];
  canEdit: boolean;
  latestRun: ResearchRunDto | null;
  onKeywordsChange: (keywords: string[]) => void;
}) {
  const [keywords, setKeywords] = useState(defaultKeywords.join(", "));
  const [ideaCount, setIdeaCount] = useState(5);
  const [pending, start] = useTransition();
  const [reports, setReports] = useState<ProviderReport[]>(providerReports(latestRun));
  const [error, setError] = useState(latestRun?.status === "failed" ? latestRun.error : null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setKeywords(defaultKeywords.join(", "));
  }, [defaultKeywords]);

  function run() {
    const keywordList = splitTags(keywords);
    setError(null);
    start(async () => {
      const result = await generateContentIdeas({ accountId, keywords: keywordList, ideaCount });
      setReports(result.reports ?? []);
      if (!result.ok) {
        setError(result.error);
        return toast("error", result.error);
      }
      onKeywordsChange(keywordList);
      toast("success", `${result.created} ide dibuat dari ${result.evidenceCount} bukti tren.`);
      router.refresh();
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-hd">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 grid place-items-center"><Search className="w-4 h-4 text-brand-600" /></div>
          <div>
            <div className="font-semibold text-slate-900">2. Riset Tren & Buat Ide</div>
            <div className="text-xs text-slate-500">Mengambil bukti baru, lalu Gemini membuat konsep dalam Bahasa Indonesia.</div>
          </div>
        </div>
        <span className="badge-blue">Real sources</span>
      </div>
      <div className="card-bd space-y-4">
        {!configured && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-3 py-2">Simpan Account Goals sebelum menjalankan riset.</div>}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8">
            <label className="label">Keyword riset kali ini</label>
            <input className="input" value={keywords} onChange={(event) => setKeywords(event.target.value)} disabled={!canEdit || pending} placeholder="AI marketing, tren UMKM, Instagram Reels" />
          </div>
          <div className="lg:col-span-2">
            <label className="label">Jumlah ide</label>
            <select className="input" value={ideaCount} onChange={(event) => setIdeaCount(Number(event.target.value))} disabled={!canEdit || pending}>
              {[3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} ide</option>)}
            </select>
          </div>
          <div className="lg:col-span-2 flex items-end">
            <button type="button" onClick={run} disabled={!canEdit || !configured || pending || splitTags(keywords).length === 0} className="btn-primary w-full">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              {pending ? "Riset + AI…" : "Buat Ide"}
            </button>
          </div>
        </div>

        {pending && (
          <div className="rounded-xl bg-slate-900 text-white p-4 flex items-start gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-300 mt-0.5" />
            <div>
              <div className="font-medium">Sedang mencari sinyal tren nyata…</div>
              <div className="text-xs text-slate-300 mt-1">Google, Bing, Algolia/Hacker News, Google grounding, dan X jika token tersedia. Setelah itu Gemini menyusun ide dan sistem mencari slot bebas konflik.</div>
            </div>
          </div>
        )}

        {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}

        {reports.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Status provider terakhir</div>
            <div className="flex gap-2 flex-wrap">
              {reports.map((item) => (
                <div key={item.provider} title={item.message} className={cn("rounded-lg border px-3 py-2 text-xs", item.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "needs_config" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-amber-200 bg-amber-50 text-amber-700")}>
                  <div className="font-semibold">{item.provider}</div>
                  <div>{item.status === "ok" ? `${item.count} sumber` : item.status === "needs_config" ? "Opsional" : item.status === "empty" ? "Kosong" : "Gagal"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, sources, timezone, canEdit }: {
  idea: ContentIdea;
  sources: TrendEvidence[];
  timezone: string;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState<ContentIdeaStatus>(idea.status);
  const [pending, start] = useTransition();
  const toast = useToast();
  const outline = parseJsonArray<string>(idea.content_outline);

  function changeStatus(next: ContentIdeaStatus) {
    const previous = status;
    setStatus(next);
    start(async () => {
      const result = await updateIdeaStatus({ ideaId: idea.id, status: next });
      if (!result.ok) {
        setStatus(previous);
        toast("error", result.error);
      } else {
        toast("success", `Status diubah menjadi ${STATUS_LABELS[next]}.`);
      }
    });
  }

  return (
    <article className={cn("card overflow-hidden", status === "diarsipkan" && "opacity-65")}>
      <div className="card-hd !items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="badge-blue">{FORMAT_LABELS[idea.content_type]}</span>
            <span className="badge-slate">{idea.category}</span>
            <span className={cn("badge border", STATUS_CLASSES[status])}>{STATUS_LABELS[status]}</span>
            <span className="text-[11px] text-slate-400">AI confidence {Math.round(idea.confidence_score)}%</span>
          </div>
          <h3 className="font-bold text-lg text-slate-900 leading-snug">{idea.title}</h3>
          <p className="text-sm text-violet-700 font-medium mt-1">“{idea.hook}”</p>
        </div>
        {canEdit && (
          <select className="input !w-auto text-xs" value={status} disabled={pending} onChange={(event) => changeStatus(event.target.value as ContentIdeaStatus)}>
            {(Object.keys(STATUS_LABELS) as ContentIdeaStatus[]).map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
        )}
      </div>

      <div className="card-bd space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <div className="text-xs uppercase tracking-wider font-semibold text-violet-600 mb-1">Sudut segar</div>
            <p className="text-sm text-slate-700 leading-relaxed">{idea.fresh_angle}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <div className="text-xs uppercase tracking-wider font-semibold text-emerald-700 mb-1">Mengapa ini penting</div>
            <p className="text-sm text-slate-700 leading-relaxed">{idea.why_factor}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-brand-600">Rekomendasi tayang</div>
              <div className="font-semibold text-slate-900 mt-0.5">{formatDateTime(idea.recommended_at, timezone)}</div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">{idea.schedule_reason}</div>
            </div>
          </div>
        </div>

        <details className="group rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between font-medium text-sm text-slate-800">
            Brief eksekusi konten
            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="border-t border-slate-100 px-4 py-4">
            <ol className="space-y-2">
              {outline.map((step, index) => <li key={index} className="flex gap-2 text-sm text-slate-700"><span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold grid place-items-center shrink-0">{index + 1}</span><span>{step}</span></li>)}
            </ol>
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-700">CTA:</span> {idea.call_to_action}</div>
          </div>
        </details>

        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2 flex items-center gap-1"><Link2 className="w-3 h-3" /> Bukti & referensi</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sources.length ? sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50 transition group">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-500">{source.source_name}</div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-600 shrink-0" />
                </div>
                <div className="text-sm text-slate-800 line-clamp-2 mt-0.5">{source.title}</div>
                <div className="text-[11px] text-slate-400 mt-1">Trend score {Math.round(source.popularity_score)}{source.published_at ? ` • ${new Date(source.published_at).toLocaleDateString("id-ID")}` : ""}</div>
              </a>
            )) : <div className="text-xs text-amber-600">Referensi tidak ditemukan. Jangan publish klaim sebelum verifikasi manual.</div>}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex justify-between flex-wrap gap-2">
          <span>Dibuat {formatDateTime(idea.created_at, timezone)} • {idea.ai_model}</span>
          {idea.published_at && <span>Ditandai terbit {formatDateTime(idea.published_at, timezone)}</span>}
        </div>
      </div>
    </article>
  );
}

export default function ContentIdeasClient({ account, initialGoals, initialIdeas, evidence, latestRun, canEdit }: {
  account: Account;
  initialGoals: GoalFormData;
  initialIdeas: ContentIdea[];
  evidence: TrendEvidence[];
  latestRun: ResearchRunDto | null;
  canEdit: boolean;
}) {
  const [keywords, setKeywords] = useState(initialGoals.keywords);
  const [configured, setConfigured] = useState(initialGoals.configured);
  const evidenceById = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const activeIdeas = initialIdeas.filter((idea) => idea.status !== "diarsipkan");
  const statusCounts = useMemo(() => Object.fromEntries((Object.keys(STATUS_LABELS) as ContentIdeaStatus[]).map((status) => [status, initialIdeas.filter((idea) => idea.status === status).length])), [initialIdeas]);

  return (
    <div className="space-y-6">
      <GoalSettings
        accountId={account.id}
        initial={initialGoals}
        canEdit={canEdit}
        onKeywordsSaved={(savedKeywords) => {
          setKeywords(savedKeywords);
          setConfigured(true);
        }}
      />
      <ResearchPanel accountId={account.id} configured={configured} defaultKeywords={keywords} canEdit={canEdit} latestRun={latestRun} onKeywordsChange={setKeywords} />

      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">3. Pipeline Ide Konten</h2>
            <p className="text-sm text-slate-500">Ubah status saat ide bergerak dari riset sampai terbit.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="badge-slate">{activeIdeas.length} aktif</span>
            <span className="badge-blue">{statusCounts.siap ?? 0} siap</span>
            <span className="badge-green">{statusCounts.terbit ?? 0} terbit</span>
          </div>
        </div>

        {!initialIdeas.length ? (
          <div className="card"><div className="card-bd py-14 text-center"><Lightbulb className="w-10 h-10 text-slate-300 mx-auto" /><div className="font-semibold text-slate-800 mt-3">Belum ada ide</div><p className="text-sm text-slate-500 mt-1">Simpan Account Goals, lalu jalankan riset tren untuk membuat ide pertama.</p></div></div>
        ) : (
          <div className="space-y-4">
            {initialIdeas.map((idea) => {
              const sourceIds = parseJsonArray<number>(idea.source_ids);
              const sources = sourceIds.map((id) => evidenceById.get(id)).filter((item): item is TrendEvidence => Boolean(item));
              return <IdeaCard key={idea.id} idea={idea} sources={sources} timezone={initialGoals.timezone} canEdit={canEdit} />;
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-hd">
          <div className="flex items-center gap-2"><Database className="w-4 h-4 text-brand-600" /><span className="font-semibold">Bukti Tren Terbaru</span></div>
          <span className="text-xs text-slate-500">{evidence.length} referensi tersimpan</span>
        </div>
        <div className="card-bd">
          {!evidence.length ? <div className="text-sm text-slate-400 text-center py-6">Belum ada bukti tren untuk akun ini.</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {evidence.slice(0, 30).map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50 transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase text-brand-600">{item.source_name}</span>
                    <span className="text-[11px] text-slate-400">Score {Math.round(item.popularity_score)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{item.title}</div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="w-3 h-3" />{item.published_at ? new Date(item.published_at).toLocaleString("id-ID") : "Waktu publikasi tidak tersedia"}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div><strong>Editorial check tetap wajib.</strong> Trend score mengukur kebaruan, relevansi keyword, dan sinyal engagement—bukan jaminan viral. Buka setiap referensi, cek konteks, hak cipta, dan klaim sebelum konten diterbitkan.</div>
      </div>
    </div>
  );
}
