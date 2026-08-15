import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Role } from "./db";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
};

export type AppSession = {
  user?: SessionUser;
};

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  // Do not throw at module-load in dev; fall back to a warning that surfaces at runtime.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET wajib diisi (minimal 32 karakter) di .env");
  }
}

export const sessionOptions: SessionOptions = {
  password: secret || "dev-only-secret-please-change-me-32chars-min",
  cookieName: "socmed_insight_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 jam
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<AppSession>(store, sessionOptions);
}

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getSession();
  return s.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Error("FORBIDDEN");
  return u;
}
