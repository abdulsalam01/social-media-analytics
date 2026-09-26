"use server";
import { z } from "zod";
import { dbRun } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { auditLog } from "@/lib/auth";

const Schema = z.object({
  name: z.string().trim().min(1, "Nama akun wajib diisi").max(120),
  handle: z.string().trim().min(1, "Handle wajib diisi").max(80).regex(/^[a-zA-Z0-9._-]+$/, "Handle hanya boleh huruf, angka, . _ -"),
  platform: z.enum(["instagram", "tiktok"]),
  initial_followers: z.number().int("Initial followers harus bilangan bulat").min(0, "Initial followers tidak boleh negatif").max(2_147_483_647),
});

type Result = { ok: true; id: number } | { ok: false; error: string };

export async function createAccount(input: unknown): Promise<Result> {
  const user = await requireRole(["admin"]);
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { name, handle, platform, initial_followers } = parsed.data;
  try {
    const res = await dbRun(
      "INSERT INTO accounts (name, platform, handle, initial_followers) VALUES (?, ?, ?, ?)",
      [name, platform, handle.toLowerCase(), initial_followers]
    );
    const id = res.lastInsertRowid;
    await auditLog(user.id, "create", "account", id, { name, platform, handle, initial_followers });
    return { ok: true, id };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const msg = err.message ?? "";
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint/i.test(msg)) {
      return { ok: false, error: `Handle @${handle} sudah terdaftar di ${platform}.` };
    }
    return { ok: false, error: msg || "Gagal menyimpan akun" };
  }
}
