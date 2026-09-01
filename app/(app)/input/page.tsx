import Link from "next/link";
import { dbAll, dbGet } from "@/lib/db";
import { requirePageRole } from "@/lib/session";
import EmptyState from "@/components/EmptyState";
import PlatformBadge from "@/components/PlatformBadge";
import InputTabs from "./InputTabs";
import AccountPicker from "@/components/AccountPicker";
import EntriesList from "./EntriesList";
import { getAccessibleAccounts, resolveActiveAccount } from "@/lib/account-access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function InputPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; view?: string; p?: string; c?: string }>;
}) {
  const user = await requirePageRole(["admin", "editor"]);
  const sp = await searchParams;
  const accounts = await getAccessibleAccounts(user);
  if (accounts.length === 0) {
    return (
      <EmptyState
        title={user.role === "admin" ? "Belum ada akun terdaftar" : "Belum ada akun yang ditugaskan"}
        description={user.role === "admin" ? "Tambah akun sosmed dulu sebelum input data." : "Minta admin menugaskan akun sebelum kamu menginput data."}
        ctaHref={user.role === "admin" ? "/accounts/new" : undefined}
        ctaLabel={user.role === "admin" ? "Tambah Akun" : undefined}
      />
    );
  }
  const account = await resolveActiveAccount(accounts, sp.account);

  const profilePage = Math.max(1, parseInt(sp.p || "1") || 1);
  const contentPage = Math.max(1, parseInt(sp.c || "1") || 1);
  const profileOffset = (profilePage - 1) * PAGE_SIZE;
  const contentOffset = (contentPage - 1) * PAGE_SIZE;

  const profileEntries = await dbAll<{
    id: number; date: string; visit_per_day: number; reach_per_day: number;
    followers: number; followers_growth: number; new_followers: number; created_at: string; updated_at: string;
  }>(
    `SELECT id, date, visit_per_day, reach_per_day, followers, followers_growth, new_followers, created_at, updated_at
     FROM profile_insight WHERE account_id = ?
     ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    [account.id, PAGE_SIZE, profileOffset]
  );

  const profileTotal = (await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM profile_insight WHERE account_id = ?",
    [account.id]
  ))?.c ?? 0;

  const contentEntries = await dbAll<{
    id: number; post_date: string; title: string | null; link: string | null; likes: number; comments: number; shares: number; saves: number;
    reposts: number; reach: number; plays: number; engagement: number; engagement_rate: number;
    profile_visit: number; follows: number; impression: number; created_at: string; updated_at: string;
  }>(
    `SELECT id, post_date, title, link, likes, comments, shares, saves, reposts, reach, plays, engagement, engagement_rate, profile_visit, follows, impression, created_at, updated_at
     FROM content_insight WHERE account_id = ?
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [account.id, PAGE_SIZE, contentOffset]
  );

  const contentTotal = (await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM content_insight WHERE account_id = ?",
    [account.id]
  ))?.c ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Input Data</h1>
          <p className="text-sm text-slate-500">Input, edit, atau hapus data performa harian & konten.</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountPicker accounts={accounts} current={account.id} basePath="/input" />
          <Link href={`/dashboard?account=${account.id}`} className="btn-secondary">
            Lihat Dashboard
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <PlatformBadge platform={account.platform} />
        <span className="text-slate-400">•</span>
        <span className="font-medium">{account.name}</span>
        <span className="text-slate-400">@{account.handle}</span>
      </div>

      <InputTabs account={account} />

      <EntriesList
        account={account}
        profileEntries={profileEntries}
        profileTotal={profileTotal}
        profilePage={profilePage}
        contentEntries={contentEntries}
        contentTotal={contentTotal}
        contentPage={contentPage}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
