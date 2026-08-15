import bcrypt from "bcryptjs";
import { dbGet, dbRun, User } from "./db";

const MAX_FAILED_PER_MIN = 5;

export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await dbRun(
    "INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, ?)",
    [email.toLowerCase(), ip, success ? 1 : 0]
  );
}

export async function isRateLimited(email: string, ip: string): Promise<boolean> {
  const row = await dbGet<{ c: number }>(
    `SELECT COUNT(*) AS c FROM login_attempts
     WHERE success = 0 AND at >= datetime('now', '-1 minute')
     AND (email = ? OR ip = ?)`,
    [email.toLowerCase(), ip]
  );
  return (row?.c ?? 0) >= MAX_FAILED_PER_MIN;
}

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = await dbGet<User>("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
  if (!user) {
    // constant-time dummy compare to reduce user-enumeration timing signal
    bcrypt.compareSync(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeuVIvS.iVOtSTz1ObSPPh3Qv6ojqYcz9O");
    return null;
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  return ok ? user : null;
}

export async function auditLog(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: number,
  meta?: unknown
): Promise<void> {
  await dbRun(
    "INSERT INTO audit_log (user_id, action, entity, entity_id, meta) VALUES (?, ?, ?, ?, ?)",
    [userId, action, entity, entityId ?? null, meta ? JSON.stringify(meta) : null]
  );
}
