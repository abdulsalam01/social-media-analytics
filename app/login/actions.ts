"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { isRateLimited, recordLoginAttempt, verifyCredentials, auditLog } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  next: z.string().optional(),
});

type Result = { ok: true; redirect: string } | { ok: false; error: string };

export async function doLogin(input: unknown): Promise<Result> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const { email, password, next } = parsed.data;

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";

  if (await isRateLimited(email, ip)) {
    return { ok: false, error: "Terlalu banyak percobaan gagal. Coba lagi dalam 1 menit." };
  }

  const user = await verifyCredentials(email, password);
  await recordLoginAttempt(email, ip, !!user);
  if (!user) return { ok: false, error: "Email atau password salah." };

  const s = await getSession();
  s.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  await s.save();
  await auditLog(user.id, "login", "user", user.id);

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return { ok: true, redirect: safeNext };
}

export async function doLogout(): Promise<void> {
  const s = await getSession();
  if (s.user) await auditLog(s.user.id, "logout", "user", s.user.id);
  s.destroy();
}
