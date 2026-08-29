"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/auth";
import { db, dbAll, dbGet, dbRun, type Account, type AccountContentGoals } from "@/lib/db";
import { generateIdeasWithGemini, type EvidenceForAI, type GoalsForAI } from "@/lib/gemini";
import { collectTrendEvidence, type ProviderReport } from "@/lib/trends";
import { scheduleContentIdeas, type ExistingSchedule, type HistoricalDayPerformance } from "@/lib/content-scheduler";
import { requireRole } from "@/lib/session";

const GoalSchema = z.object({
  accountId: z.number().int().positive(),
  primaryGoal: z.enum(["growth", "engagement", "reach", "awareness", "leads", "sales"]),
  targetAudience: z.string().trim().min(10, "Target audiens minimal 10 karakter").max(1000),
  brandVoice: z.string().trim().min(3).max(500),
  contentPillars: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(12),
  preferredFormats: z.array(z.enum(["carousel", "video", "kombinasi"])).min(1),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  audienceActiveHours: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(6),
  postsPerWeek: z.number().int().min(1).max(14),
  timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
  additionalContext: z.string().trim().max(2000).nullable(),
});

const GenerateSchema = z.object({
  accountId: z.number().int().positive(),
  keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(12),
  ideaCount: z.number().int().min(3).max(8),
});

const StatusSchema = z.object({
  ideaId: z.number().int().positive(),
  status: z.enum(["ide", "dikembangkan", "siap", "terjadwal", "terbit", "diarsipkan"]),
});

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseNumberArray(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

export async function saveContentGoals(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const parsed = GoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Pengaturan goal tidak valid" };
  const goal = parsed.data;

  const account = await dbGet<{ id: number }>("SELECT id FROM accounts WHERE id = ?", [goal.accountId]);
  if (!account) return { ok: false as const, error: "Akun tidak ditemukan" };

  await dbRun(
    `INSERT INTO account_content_goals
       (account_id, primary_goal, target_audience, brand_voice, content_pillars, keywords,
        preferred_formats, preferred_days, audience_active_hours, posts_per_week, timezone,
        additional_context, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(account_id) DO UPDATE SET
       primary_goal = excluded.primary_goal,
       target_audience = excluded.target_audience,
       brand_voice = excluded.brand_voice,
       content_pillars = excluded.content_pillars,
       keywords = excluded.keywords,
       preferred_formats = excluded.preferred_formats,
       preferred_days = excluded.preferred_days,
       audience_active_hours = excluded.audience_active_hours,
       posts_per_week = excluded.posts_per_week,
       timezone = excluded.timezone,
       additional_context = excluded.additional_context,
       updated_at = datetime('now')`,
    [
      goal.accountId,
      goal.primaryGoal,
      goal.targetAudience,
      goal.brandVoice,
      JSON.stringify(goal.contentPillars),
      JSON.stringify(goal.keywords),
      JSON.stringify(goal.preferredFormats),
      JSON.stringify(goal.preferredDays),
      JSON.stringify(goal.audienceActiveHours),
      goal.postsPerWeek,
      goal.timezone,
      goal.additionalContext || null,
    ]
  );
  await auditLog(user.id, "upsert", "account_content_goals", goal.accountId, { primary_goal: goal.primaryGoal });
  revalidatePath("/ideas");
  return { ok: true as const };
}

export async function generateContentIdeas(input: unknown): Promise<
  | { ok: true; created: number; evidenceCount: number; reports: ProviderReport[] }
  | { ok: false; error: string; reports?: ProviderReport[] }
> {
  const user = await requireRole(["admin", "editor"]);
  const parsed = GenerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input riset tidak valid" };
  const { accountId, keywords, ideaCount } = parsed.data;

  const account = await dbGet<Account>("SELECT * FROM accounts WHERE id = ?", [accountId]);
  const goals = await dbGet<AccountContentGoals>("SELECT * FROM account_content_goals WHERE account_id = ?", [accountId]);
  if (!account) return { ok: false, error: "Akun tidak ditemukan" };
  if (!goals) return { ok: false, error: "Simpan Account Goals terlebih dahulu sebelum membuat ide" };

  const run = await dbRun(
    `INSERT INTO trend_research_runs (account_id, query, keywords, status, created_by)
     VALUES (?, ?, ?, 'running', ?)`,
    [accountId, keywords.join(" OR "), JSON.stringify(keywords), user.id]
  );
  const runId = run.lastInsertRowid;
  let reports: ProviderReport[] = [];

  try {
    const collected = await collectTrendEvidence(keywords);
    reports = collected.reports;
    if (!collected.items.length) throw new Error("Tidak ada sumber tren yang berhasil dikumpulkan. Periksa koneksi provider lalu coba lagi.");

    await db.batch(
      collected.items.map((item) => ({
        sql: `INSERT OR IGNORE INTO trend_evidence
              (run_id, provider, source_name, title, url, excerpt, published_at, popularity_score, raw_metrics)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          runId, item.provider, item.sourceName, item.title, item.url, item.excerpt,
          item.publishedAt, item.popularityScore, JSON.stringify(item.rawMetrics),
        ],
      })),
      "write"
    );

    const storedEvidence = await dbAll<EvidenceForAI>(
      `SELECT id, source_name AS sourceName, title, url, excerpt,
              published_at AS publishedAt, popularity_score AS popularityScore
       FROM trend_evidence WHERE run_id = ? ORDER BY popularity_score DESC LIMIT 24`,
      [runId]
    );
    if (!storedEvidence.length) throw new Error("Bukti tren gagal disimpan ke database");

    const aiGoals: GoalsForAI = {
      primaryGoal: goals.primary_goal,
      targetAudience: goals.target_audience,
      brandVoice: goals.brand_voice,
      contentPillars: parseStringArray(goals.content_pillars),
      keywords,
      preferredFormats: parseStringArray(goals.preferred_formats).filter((format): format is "carousel" | "video" | "kombinasi" => ["carousel", "video", "kombinasi"].includes(format)),
      additionalContext: goals.additional_context,
    };
    const generated = await generateIdeasWithGemini({ account, goals: aiGoals, evidence: storedEvidence, ideaCount });

    const [history, existing] = await Promise.all([
      dbAll<HistoricalDayPerformance>(
        `SELECT CAST(strftime('%w', post_date) AS INTEGER) AS weekday,
                AVG(engagement_rate) AS avg_engagement_rate,
                AVG(engagement) AS avg_engagement,
                COUNT(*) AS posts
         FROM content_insight
         WHERE account_id = ?
         GROUP BY CAST(strftime('%w', post_date) AS INTEGER)`,
        [accountId]
      ),
      dbAll<ExistingSchedule>(
        `SELECT recommended_at FROM content_ideas
         WHERE account_id = ? AND recommended_at IS NOT NULL
           AND status NOT IN ('terbit','diarsipkan')
           AND recommended_at >= datetime('now', '-2 hours')`,
        [accountId]
      ),
    ]);

    const scheduled = scheduleContentIdeas({
      ideas: generated.ideas,
      platform: account.platform,
      goals: {
        preferredDays: parseNumberArray(goals.preferred_days),
        audienceActiveHours: parseStringArray(goals.audience_active_hours),
        postsPerWeek: goals.posts_per_week,
        timezone: goals.timezone,
      },
      history,
      existing,
    });

    await db.batch(
      scheduled.map((idea) => {
        const sourceIds = idea.sourceIndices
          .map((index) => storedEvidence[index - 1]?.id)
          .filter((id): id is number => typeof id === "number");
        return {
          sql: `INSERT INTO content_ideas
                (account_id, research_run_id, title, hook, fresh_angle, content_type, category,
                 why_factor, content_outline, call_to_action, status, recommended_at,
                 schedule_reason, confidence_score, source_ids, ai_model, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ide', ?, ?, ?, ?, ?, ?)`,
          args: [
            accountId, runId, idea.title, idea.hook, idea.freshAngle, idea.contentType,
            idea.category, idea.whyFactor, JSON.stringify(idea.contentOutline), idea.callToAction,
            idea.recommendedAt, idea.scheduleReason, idea.confidenceScore,
            JSON.stringify(sourceIds), generated.model, user.id,
          ],
        };
      }),
      "write"
    );

    await dbRun(
      `UPDATE trend_research_runs SET status = 'completed', provider_summary = ?, evidence_count = ?,
       completed_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(reports), storedEvidence.length, runId]
    );
    await auditLog(user.id, "generate", "content_ideas", accountId, {
      count: scheduled.length,
      evidence_count: storedEvidence.length,
      run_id: runId,
      model: generated.model,
    });
    revalidatePath("/ideas");
    return { ok: true, created: scheduled.length, evidenceCount: storedEvidence.length, reports };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Riset tren atau Gemini gagal";
    await dbRun(
      `UPDATE trend_research_runs SET status = 'failed', provider_summary = ?, error = ?,
       completed_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(reports), message.slice(0, 1000), runId]
    );
    revalidatePath("/ideas");
    return { ok: false, error: message, reports };
  }
}

export async function updateIdeaStatus(input: unknown) {
  const user = await requireRole(["admin", "editor"]);
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Status tidak valid" };
  const { ideaId, status } = parsed.data;
  const result = await dbRun(
    `UPDATE content_ideas SET status = ?, updated_at = datetime('now'),
       published_at = CASE WHEN ? = 'terbit' THEN COALESCE(published_at, datetime('now')) ELSE published_at END
     WHERE id = ?`,
    [status, status, ideaId]
  );
  if (!result.changes) return { ok: false as const, error: "Ide tidak ditemukan" };
  await auditLog(user.id, "update_status", "content_idea", ideaId, { status });
  revalidatePath("/ideas");
  return { ok: true as const };
}
