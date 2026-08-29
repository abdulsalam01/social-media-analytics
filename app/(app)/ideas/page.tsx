import { Sparkles, ShieldCheck } from "lucide-react";
import AccountPicker from "@/components/AccountPicker";
import EmptyState from "@/components/EmptyState";
import PlatformBadge from "@/components/PlatformBadge";
import { dbAll, dbGet, type Account, type AccountContentGoals, type ContentIdea, type TrendEvidence } from "@/lib/db";
import { requirePageRole } from "@/lib/session";
import ContentIdeasClient, { type GoalFormData, type ResearchRunDto } from "./ContentIdeasClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function goalDto(goal: AccountContentGoals | undefined, account: Account): GoalFormData {
  if (!goal) {
    return {
      primaryGoal: "growth",
      targetAudience: "",
      brandVoice: "Informatif, hangat, jelas, dan tidak berlebihan",
      contentPillars: [],
      keywords: [],
      preferredFormats: account.platform === "tiktok" ? ["video"] : ["carousel", "video"],
      preferredDays: [1, 2, 3, 4, 5],
      audienceActiveHours: [],
      postsPerWeek: 3,
      timezone: "Asia/Jakarta",
      additionalContext: "",
      configured: false,
    };
  }
  return {
    primaryGoal: goal.primary_goal,
    targetAudience: goal.target_audience,
    brandVoice: goal.brand_voice,
    contentPillars: parseArray<string>(goal.content_pillars, []),
    keywords: parseArray<string>(goal.keywords, []),
    preferredFormats: parseArray<"carousel" | "video" | "kombinasi">(goal.preferred_formats, ["video"]),
    preferredDays: parseArray<number>(goal.preferred_days, [1, 2, 3, 4, 5]),
    audienceActiveHours: parseArray<string>(goal.audience_active_hours, []),
    postsPerWeek: goal.posts_per_week,
    timezone: goal.timezone as GoalFormData["timezone"],
    additionalContext: goal.additional_context || "",
    configured: true,
  };
}

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const user = await requirePageRole(["admin", "editor", "viewer"]);
  const params = await searchParams;
  const accounts = await dbAll<Account>("SELECT * FROM accounts ORDER BY name ASC");

  if (!accounts.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ide Konten AI</h1>
          <p className="text-sm text-slate-500">Riset tren nyata dan ubah menjadi rencana konten yang bisa dikerjakan tim.</p>
        </div>
        <EmptyState title="Belum ada akun" description="Tambahkan akun sosial media sebelum mengatur goal dan membuat ide." ctaHref="/accounts/new" ctaLabel="Tambah Akun" />
      </div>
    );
  }

  const requestedId = Number(params.account);
  const account = accounts.find((item) => item.id === requestedId) ?? accounts[0];
  const [goal, ideas, evidence, latestRun] = await Promise.all([
    dbGet<AccountContentGoals>("SELECT * FROM account_content_goals WHERE account_id = ?", [account.id]),
    dbAll<ContentIdea>(
      `SELECT * FROM content_ideas WHERE account_id = ?
       ORDER BY CASE status WHEN 'terjadwal' THEN 0 WHEN 'siap' THEN 1 WHEN 'dikembangkan' THEN 2 WHEN 'ide' THEN 3 WHEN 'terbit' THEN 4 ELSE 5 END,
                recommended_at ASC, created_at DESC LIMIT 60`,
      [account.id]
    ),
    dbAll<TrendEvidence>(
      `SELECT e.* FROM trend_evidence e
       JOIN trend_research_runs r ON r.id = e.run_id
       WHERE r.account_id = ? ORDER BY e.created_at DESC, e.popularity_score DESC LIMIT 120`,
      [account.id]
    ),
    dbGet<ResearchRunDto>(
      `SELECT id, status, provider_summary, evidence_count, error, started_at, completed_at
       FROM trend_research_runs WHERE account_id = ? ORDER BY started_at DESC LIMIT 1`,
      [account.id]
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-brand-500 grid place-items-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Ide Konten AI</h1>
              <p className="text-sm text-slate-500">Riset tren → bukti sumber → ide segar → jadwal tanpa bentrok.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <PlatformBadge platform={account.platform} />
            <span className="text-sm font-medium text-slate-700">{account.name}</span>
            <span className="text-sm text-slate-500">@{account.handle}</span>
            <span className="badge-green"><ShieldCheck className="w-3 h-3" /> Gemini server-side</span>
          </div>
        </div>
        <AccountPicker accounts={accounts} current={account.id} basePath="/ideas" />
      </div>

      <ContentIdeasClient
        key={account.id}
        account={JSON.parse(JSON.stringify(account))}
        initialGoals={goalDto(goal, account)}
        initialIdeas={JSON.parse(JSON.stringify(ideas))}
        evidence={JSON.parse(JSON.stringify(evidence))}
        latestRun={latestRun ? JSON.parse(JSON.stringify(latestRun)) : null}
        canEdit={user.role === "admin" || user.role === "editor"}
      />
    </div>
  );
}
