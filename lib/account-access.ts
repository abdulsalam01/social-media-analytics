import "server-only";

import { dbAll, dbGet, type Account } from "./db";
import type { SessionUser } from "./session";
import { cookies } from "next/headers";
import { ACTIVE_ACCOUNT_COOKIE } from "./account-selection";

type AccessUser = Pick<SessionUser, "id" | "role">;

/** Admin sees every account; other roles only see explicitly assigned accounts. */
export async function getAccessibleAccounts(user: AccessUser): Promise<Account[]> {
  if (user.role === "admin") {
    return dbAll<Account>("SELECT * FROM accounts ORDER BY name ASC");
  }
  return dbAll<Account>(
    `SELECT a.*
     FROM accounts a
     INNER JOIN user_account_access uaa ON uaa.account_id = a.id
     WHERE uaa.user_id = ?
     ORDER BY a.name ASC`,
    [user.id]
  );
}

export async function hasAccountAccess(user: AccessUser, accountId: number): Promise<boolean> {
  if (!Number.isInteger(accountId) || accountId <= 0) return false;
  if (user.role === "admin") {
    return Boolean(await dbGet<{ id: number }>("SELECT id FROM accounts WHERE id = ?", [accountId]));
  }
  return Boolean(await dbGet<{ account_id: number }>(
    "SELECT account_id FROM user_account_access WHERE user_id = ? AND account_id = ?",
    [user.id, accountId]
  ));
}

/**
 * Resolve the active account consistently across pages. A valid URL selection
 * wins; otherwise use the last account selected in the shared account picker.
 * Revoked/inaccessible account IDs are ignored safely.
 */
export async function resolveActiveAccount(
  accounts: Account[],
  requestedAccount: string | number | null | undefined
): Promise<Account> {
  if (!accounts.length) throw new Error("Tidak ada akun yang dapat diakses");

  const requestedId = typeof requestedAccount === "number"
    ? requestedAccount
    : Number.parseInt(requestedAccount || "", 10);
  const requested = Number.isInteger(requestedId)
    ? accounts.find((account) => account.id === requestedId)
    : undefined;
  if (requested) return requested;

  const cookieStore = await cookies();
  const storedId = Number.parseInt(cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value || "", 10);
  return accounts.find((account) => account.id === storedId) ?? accounts[0];
}

export async function getAccountIdForContent(contentId: number): Promise<number | null> {
  const row = await dbGet<{ account_id: number }>("SELECT account_id FROM content_insight WHERE id = ?", [contentId]);
  return row?.account_id ?? null;
}

export async function getAccountIdForProfile(profileId: number): Promise<number | null> {
  const row = await dbGet<{ account_id: number }>("SELECT account_id FROM profile_insight WHERE id = ?", [profileId]);
  return row?.account_id ?? null;
}

export async function getAccountIdForIdea(ideaId: number): Promise<number | null> {
  const row = await dbGet<{ account_id: number }>("SELECT account_id FROM content_ideas WHERE id = ?", [ideaId]);
  return row?.account_id ?? null;
}
