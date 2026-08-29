import { NextRequest, NextResponse } from "next/server";
import { runScrapeAll, runScrapeForAccount } from "@/lib/scraper";
import { currentUser } from "@/lib/session";

// POST /api/scrape — trigger scrape for all enabled accounts (cron) or specific account
// Auth: Vercel cron header OR authenticated admin/editor session
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Check Vercel cron auth header
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // Check session auth
  let sessionUserId: number | undefined;
  if (!isCron) {
    const user = await currentUser();
    if (!user || (user.role !== "admin" && user.role !== "editor")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    sessionUserId = user.id;
  }

  const body = await req.json().catch(() => ({}));
  const accountId = typeof body?.account_id === "number" ? body.account_id : null;

  if (accountId) {
    const result = await runScrapeForAccount(accountId, sessionUserId);
    return NextResponse.json({ ok: result.status === "ok", results: [result] });
  }

  const results = await runScrapeAll(sessionUserId);
  const failed = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ ok: true, total: results.length, failed, results });
}

// GET /api/scrape — run Vercel cron when authorized, otherwise return account status
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (isCron) {
    const results = await runScrapeAll();
    const failed = results.filter((result) => result.status === "error").length;
    return NextResponse.json({ ok: failed === 0, total: results.length, failed, results });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dbAll } = await import("@/lib/db");
  const accounts = await dbAll(
    `SELECT a.id, a.name, a.handle, a.platform, a.scrape_enabled,
            a.last_scraped_at, a.last_scrape_status,
            (SELECT COUNT(*) FROM content_insight ci WHERE ci.account_id = a.id AND ci.scrape_enabled = 1) AS tracked_posts
     FROM accounts a
     ORDER BY a.name`
  );
  return NextResponse.json({ accounts });
}
