import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { dbAll, isRemoteDb } from "@/lib/db";
import { auditLog } from "@/lib/auth";

/**
 * Backup endpoint:
 * - Local file mode: returns raw SQLite file (better for restore fidelity).
 * - Remote Turso: returns JSON dump of all tables (Turso HTTP has no file-copy;
 *   use `turso db dump` CLI or Turso dashboard for full binary backup).
 */
export async function GET() {
  let user;
  try {
    user = await requireRole(["admin"]);
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!isRemoteDb()) {
    // Local file: read + stream
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "data.db");
    if (!fs.existsSync(dbPath)) return new NextResponse("Database file not found", { status: 404 });
    const buf = fs.readFileSync(dbPath);
    await auditLog(user.id, "backup", "database");
    const now = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="socmed-insight-${now}.db"`,
      },
    });
  }

  // Remote Turso: JSON dump
  const [users, accounts, profile, content, demographics, contentGoals, researchRuns, trendEvidence, contentIdeas] = await Promise.all([
    dbAll("SELECT id, email, name, role, created_at FROM users"),
    dbAll("SELECT * FROM accounts"),
    dbAll("SELECT * FROM profile_insight"),
    dbAll("SELECT * FROM content_insight"),
    dbAll("SELECT * FROM demographics"),
    dbAll("SELECT * FROM account_content_goals"),
    dbAll("SELECT * FROM trend_research_runs"),
    dbAll("SELECT * FROM trend_evidence"),
    dbAll("SELECT * FROM content_ideas"),
  ]);
  const dump = {
    generated_at: new Date().toISOString(),
    schema_version: 2,
    warning: "Passwords intentionally excluded. Import via custom script.",
    users,
    accounts,
    profile_insight: profile,
    content_insight: content,
    demographics,
    account_content_goals: contentGoals,
    trend_research_runs: researchRuns,
    trend_evidence: trendEvidence,
    content_ideas: contentIdeas,
  };
  await auditLog(user.id, "backup_json", "database");
  const now = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="socmed-insight-${now}.json"`,
    },
  });
}
