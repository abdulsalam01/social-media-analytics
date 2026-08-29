"use server";
import { z } from "zod";
import { dbRun } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";
import { hasAccountAccess } from "@/lib/account-access";

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  handle: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/, "Handle hanya boleh huruf, angka, . _ -"),
  platform: z.enum(["instagram", "tiktok"]),
});

type Result = { ok: true } | { ok: false; error: string };

export async function updateAccount(input: unknown): Promise<Result> {
  const user = await requireRole(["admin", "editor"]);
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { id, name, handle, platform } = parsed.data;
  if (!(await hasAccountAccess(user, id))) return { ok: false, error: "Kamu tidak punya akses ke akun ini" };
  try {
    const res = await dbRun(
      "UPDATE accounts SET name = ?, handle = ?, platform = ? WHERE id = ?",
      [name, handle.toLowerCase(), platform, id]
    );
    if (res.changes === 0) return { ok: false, error: "Akun tidak ditemukan" };
    await auditLog(user.id, "update", "account", id, { name, handle, platform });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const msg = err.message ?? "";
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint/i.test(msg)) {
      return { ok: false, error: `Handle @${handle} sudah dipakai di platform ${platform}.` };
    }
    return { ok: false, error: msg || "Gagal update akun" };
  }
}

export async function deleteAccount(id: number): Promise<Result> {
  const user = await requireRole(["admin"]);
  const res = await dbRun("DELETE FROM accounts WHERE id = ?", [id]);
  if (res.changes === 0) return { ok: false, error: "Akun tidak ditemukan" };
  await auditLog(user.id, "delete", "account", id);
  return { ok: true };
}
