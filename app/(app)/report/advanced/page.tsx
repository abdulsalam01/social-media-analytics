import { dbAll } from "@/lib/db";
import EmptyState from "@/components/EmptyState";
import AccountPicker from "@/components/AccountPicker";
import ReportSubNav from "../ReportSubNav";
import AdvancedCompare from "./AdvancedCompare";
import { getAccessibleAccounts } from "@/lib/account-access";
import { requirePageRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type PostRow = {
  id: number;
  post_date: string;
  title: string | null;
  link: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  reach: number;
  plays: number;
  impression: number;
  engagement: number;
  engagement_rate: number;
};

export default async function AdvancedReportPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; ids?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageRole(["admin", "editor", "viewer"]);
  const accounts = await getAccessibleAccounts(user);

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={user.role === "admin" ? "Belum ada akun" : "Belum ada akun yang ditugaskan"}
        description={user.role === "admin" ? "Tambah akun sosmed dulu." : "Minta admin menugaskan akun agar konten dapat dibandingkan."}
        ctaHref={user.role === "admin" ? "/accounts/new" : undefined}
        ctaLabel={user.role === "admin" ? "Tambah Akun" : undefined}
      />
    );
  }

  const accountId = sp.account ? parseInt(sp.account) : accounts[0].id;
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  // Latest 100 posts for this account — for the selector
  const posts = await dbAll<PostRow>(
    `SELECT id, post_date, title, link, likes, comments, shares, saves, reposts, reach, plays, impression, engagement, engagement_rate
     FROM content_insight
     WHERE account_id = ?
     ORDER BY post_date DESC, id DESC
     LIMIT 100`,
    [account.id]
  );

  // Preselected IDs from URL (?ids=1,2,3)
  const selectedIds = sp.ids
    ? sp.ids.split(",").map((s) => parseInt(s)).filter((n) => !isNaN(n))
    : [];

  return (
    <div className="space-y-6">
      <div className="no-print flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandingkan Konten</h1>
          <p className="text-sm text-slate-500">
            Pilih 2+ konten untuk analisa side-by-side (chart, growth, winner per metrik).
          </p>
          <div className="mt-3"><ReportSubNav /></div>
        </div>
        <AccountPicker accounts={accounts} current={account.id} basePath="/report/advanced" />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Belum ada konten untuk dibandingkan"
          description="Input konten dulu di menu Input Data."
          ctaHref={`/input?account=${account.id}`}
          ctaLabel="Input Konten"
        />
      ) : (
        <AdvancedCompare
          account={JSON.parse(JSON.stringify(account))}
          posts={JSON.parse(JSON.stringify(posts))}
          initialSelectedIds={selectedIds}
        />
      )}
    </div>
  );
}
