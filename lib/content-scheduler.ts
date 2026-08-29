import type { Platform } from "./db";
import type { GeneratedIdea } from "./gemini";

export type HistoricalDayPerformance = {
  weekday: number;
  avg_engagement_rate: number;
  avg_engagement: number;
  posts: number;
};

export type ExistingSchedule = { recommended_at: string };

export type SchedulingGoals = {
  preferredDays: number[];
  audienceActiveHours: string[];
  postsPerWeek: number;
  timezone: string;
};

export type ScheduledIdea = GeneratedIdea & {
  recommendedAt: string;
  scheduleReason: string;
};

const TIMEZONE_OFFSETS: Record<string, number> = {
  "Asia/Jakarta": 7,
  "Asia/Makassar": 8,
  "Asia/Jayapura": 9,
};

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const PLATFORM_BASELINES: Record<Platform, string[]> = {
  instagram: ["11:00", "18:00", "20:00"],
  tiktok: ["12:00", "19:00", "21:00"],
};

function parseUtc(value: string): number {
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(iso).getTime();
}

function localDateKey(utcMs: number, offset: number): string {
  return new Date(utcMs + offset * 3_600_000).toISOString().slice(0, 10);
}

function localWeekKey(utcMs: number, offset: number): string {
  const local = new Date(utcMs + offset * 3_600_000);
  const day = local.getUTCDay();
  const mondayDistance = day === 0 ? -6 : 1 - day;
  local.setUTCDate(local.getUTCDate() + mondayDistance);
  return local.toISOString().slice(0, 10);
}

function matchesWindow(hour: number, window: GeneratedIdea["preferredWindow"]): boolean {
  if (window === "bebas") return true;
  if (window === "pagi") return hour >= 5 && hour <= 10;
  if (window === "siang") return hour >= 11 && hour <= 14;
  if (window === "sore") return hour >= 15 && hour <= 18;
  return hour >= 19 || hour <= 1;
}

function safeHours(hours: string[], platform: Platform): { hours: string[]; fromAudienceInsights: boolean } {
  const clean = [...new Set(hours.filter((hour) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hour)))];
  return clean.length
    ? { hours: clean, fromAudienceInsights: true }
    : { hours: PLATFORM_BASELINES[platform], fromAudienceInsights: false };
}

function normalizedHistory(rows: HistoricalDayPerformance[]): Map<number, number> {
  const maxRate = Math.max(0, ...rows.map((row) => Number(row.avg_engagement_rate ?? 0)));
  const maxEngagement = Math.max(0, ...rows.map((row) => Number(row.avg_engagement ?? 0)));
  return new Map(rows.map((row) => {
    const rate = maxRate > 0 ? Number(row.avg_engagement_rate) / maxRate : 0;
    const engagement = maxEngagement > 0 ? Number(row.avg_engagement) / maxEngagement : 0;
    const confidence = Math.min(1, Number(row.posts) / 5);
    return [Number(row.weekday), (rate * 0.65 + engagement * 0.35) * 30 * confidence];
  }));
}

export function scheduleContentIdeas(input: {
  ideas: GeneratedIdea[];
  platform: Platform;
  goals: SchedulingGoals;
  history: HistoricalDayPerformance[];
  existing: ExistingSchedule[];
  now?: Date;
}): ScheduledIdea[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const offset = TIMEZONE_OFFSETS[input.goals.timezone] ?? 7;
  const localNow = new Date(nowMs + offset * 3_600_000);
  const historyScores = normalizedHistory(input.history);
  const active = safeHours(input.goals.audienceActiveHours, input.platform);
  const allowedDays = input.goals.preferredDays.length ? new Set(input.goals.preferredDays) : new Set([0, 1, 2, 3, 4, 5, 6]);
  const occupied = input.existing
    .map((slot) => parseUtc(slot.recommended_at))
    .filter((value) => Number.isFinite(value));

  const scheduled: ScheduledIdea[] = [];
  for (const idea of [...input.ideas].sort((a, b) => a.urgencyDays - b.urgencyDays)) {
    let best: { utcMs: number; score: number; weekday: number; localTime: string; dayOffset: number } | null = null;

    for (let dayOffset = 0; dayOffset <= 28; dayOffset++) {
      const localDate = new Date(Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate() + dayOffset
      ));
      const weekday = localDate.getUTCDay();
      if (!allowedDays.has(weekday)) continue;

      for (const time of active.hours) {
        const [hour, minute] = time.split(":").map(Number);
        const utcMs = Date.UTC(
          localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(),
          hour - offset, minute, 0
        );
        if (utcMs < nowMs + 2 * 3_600_000) continue;
        if (occupied.some((value) => Math.abs(value - utcMs) < 2 * 3_600_000)) continue;

        const sameDayCount = occupied.filter((value) => localDateKey(value, offset) === localDateKey(utcMs, offset)).length;
        const sameWeekCount = occupied.filter((value) => localWeekKey(value, offset) === localWeekKey(utcMs, offset)).length;
        const historyScore = historyScores.get(weekday) ?? 0;
        const audienceScore = active.fromAudienceInsights ? 34 : 20;
        const urgencyScore = dayOffset <= idea.urgencyDays
          ? 22 - dayOffset * 0.45
          : Math.max(-25, 15 - (dayOffset - idea.urgencyDays) * 5);
        const formatBonus = matchesWindow(hour, idea.preferredWindow) ? 10 : 0;
        const balanceScore = 14 - sameDayCount * 12 - Math.max(0, sameWeekCount - input.goals.postsPerWeek + 1) * 20;
        const score = historyScore + audienceScore + urgencyScore + formatBonus + balanceScore;

        if (!best || score > best.score || (score === best.score && utcMs < best.utcMs)) {
          best = { utcMs, score, weekday, localTime: time, dayOffset };
        }
      }
    }

    if (!best) {
      const fallbackMs = nowMs + (scheduled.length + 1) * 24 * 3_600_000;
      best = { utcMs: fallbackMs, score: 0, weekday: new Date(fallbackMs + offset * 3_600_000).getUTCDay(), localTime: "—", dayOffset: scheduled.length + 1 };
    }

    occupied.push(best.utcMs);
    const recommendationSource = active.fromAudienceInsights
      ? "jam aktif audiens yang disimpan dari Insights resmi"
      : "baseline eksperimen platform karena jam aktif audiens belum diisi";
    const historyNote = historyScores.has(best.weekday)
      ? `performa historis akun pada ${DAY_NAMES[best.weekday]}`
      : `hari pilihan tim (${DAY_NAMES[best.weekday]})`;
    const localDisplay = new Intl.DateTimeFormat("id-ID", {
      timeZone: input.goals.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(best.utcMs));

    scheduled.push({
      ...idea,
      recommendedAt: new Date(best.utcMs).toISOString().replace("T", " ").slice(0, 19),
      scheduleReason: `${localDisplay} (${input.goals.timezone}) dipilih dari ${recommendationSource}, ${historyNote}, urgensi tren ${idea.urgencyDays} hari, target ${input.goals.postsPerWeek} post/minggu, dan slot bebas konflik ±2 jam.`,
    });
  }

  return scheduled;
}
