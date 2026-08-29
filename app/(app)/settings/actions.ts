"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbGet, dbRun, dbExec, isRemoteDb } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";

const NewUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "editor", "viewer"]),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export async function createUser(input: unknown) {
  const me = await requireRole(["admin"]);
  const p = NewUserSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Input tidak valid" };
  const { email, name, role, password } = p.data;
  try {
    const hash = bcrypt.hashSync(password, 12);
    const res = await dbRun(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
      [email.toLowerCase(), hash, name, role]
    );
    await auditLog(me.id, "create", "user", res.lastInsertRowid, { email, role });
    return { ok: true as const };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const msg = err.message ?? "";
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint/i.test(msg)) return { ok: false as const, error: "Email sudah terdaftar" };
    return { ok: false as const, error: msg || "Gagal buat pengguna" };
  }
}

export async function deleteUser(id: number) {
  const me = await requireRole(["admin"]);
  if (id === me.id) return { ok: false as const, error: "Tidak bisa hapus akun sendiri" };
  await dbRun("DELETE FROM users WHERE id = ?", [id]);
  await auditLog(me.id, "delete", "user", id);
  return { ok: true as const };
}

export async function resetPassword(id: number, password: string) {
  const me = await requireRole(["admin"]);
  if (!password || password.length < 8) return { ok: false as const, error: "Password minimal 8 karakter" };
  const hash = bcrypt.hashSync(password, 12);
  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
  await auditLog(me.id, "reset_password", "user", id);
  return { ok: true as const };
}

export async function resetAllData(confirmPhrase: string) {
  const me = await requireRole(["admin"]);
  if (confirmPhrase !== "RESET SEMUA DATA") {
    return { ok: false as const, error: "Frasa konfirmasi salah" };
  }
  const before = (await dbGet<{ accounts: number; profile: number; content: number; demographics: number; contentIdeas: number; trendEvidence: number }>(
    `SELECT
       (SELECT COUNT(*) FROM accounts) AS accounts,
       (SELECT COUNT(*) FROM profile_insight) AS profile,
       (SELECT COUNT(*) FROM content_insight) AS content,
       (SELECT COUNT(*) FROM demographics) AS demographics,
       (SELECT COUNT(*) FROM content_ideas) AS contentIdeas,
       (SELECT COUNT(*) FROM trend_evidence) AS trendEvidence`
  ))!;

  // Batch DELETEs — CASCADE handles FKs but explicit order ensures correctness
  await dbRun("DELETE FROM content_ideas");
  await dbRun("DELETE FROM trend_evidence");
  await dbRun("DELETE FROM trend_research_runs");
  await dbRun("DELETE FROM account_content_goals");
  await dbRun("DELETE FROM demographics");
  await dbRun("DELETE FROM content_insight");
  await dbRun("DELETE FROM profile_insight");
  await dbRun("DELETE FROM accounts");
  await dbRun("DELETE FROM sqlite_sequence WHERE name IN ('accounts','profile_insight','content_insight','demographics','trend_research_runs','trend_evidence','content_ideas')");

  await auditLog(me.id, "reset_all_data", "system", undefined, before);

  // Turso remote doesn't support VACUUM via HTTP; local file does. Silent skip on remote.
  if (!isRemoteDb()) {
    try { await dbExec("VACUUM"); } catch { /* ignore — not supported on some backends */ }
  }

  return { ok: true as const, cleared: before };
}

export async function clearScrapeLog(scope: "all" | "errors_only") {
  const me = await requireRole(["admin"]);
  const before = (await dbGet<{ total: number; errors: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
     FROM scrape_log`
  ))!;

  if (scope === "all") {
    await dbRun("DELETE FROM scrape_log");
    await dbRun("DELETE FROM sqlite_sequence WHERE name = 'scrape_log'");
  } else {
    await dbRun("DELETE FROM scrape_log WHERE status = 'error'");
  }

  await auditLog(me.id, "clear_scrape_log", "system", undefined, { scope, before });

  if (!isRemoteDb()) {
    try { await dbExec("VACUUM"); } catch { /* ignore */ }
  }

  return { ok: true as const, cleared: before, scope };
}

export async function clearLogs(scope: "all" | "audit" | "login") {
  const me = await requireRole(["admin"]);
  const before = (await dbGet<{ audit: number; login: number }>(
    `SELECT
       (SELECT COUNT(*) FROM audit_log) AS audit,
       (SELECT COUNT(*) FROM login_attempts) AS login`
  ))!;

  if (scope === "all" || scope === "audit") await dbRun("DELETE FROM audit_log");
  if (scope === "all" || scope === "login") await dbRun("DELETE FROM login_attempts");
  const names: string[] = [];
  if (scope === "all" || scope === "audit") names.push("'audit_log'");
  if (scope === "all" || scope === "login") names.push("'login_attempts'");
  if (names.length) await dbRun(`DELETE FROM sqlite_sequence WHERE name IN (${names.join(",")})`);

  await auditLog(me.id, "clear_logs", "system", undefined, { scope, before });

  if (!isRemoteDb()) {
    try { await dbExec("VACUUM"); } catch { /* ignore */ }
  }

  return { ok: true as const, cleared: before, scope };
}
