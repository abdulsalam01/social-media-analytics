import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { dbGet, Account } from "@/lib/db";
import { requirePageRole } from "@/lib/session";
import EditAccountForm from "./EditAccountForm";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["admin", "editor"]);
  const { id } = await params;
  const account = await dbGet<Account>("SELECT * FROM accounts WHERE id = ?", [parseInt(id)]);
  if (!account) notFound();

  const stats = (await dbGet<{ profile_rows: number; content_rows: number }>(
    `SELECT
       (SELECT COUNT(*) FROM profile_insight WHERE account_id = ?) AS profile_rows,
       (SELECT COUNT(*) FROM content_insight WHERE account_id = ?) AS content_rows`,
    [account.id, account.id]
  ))!;

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar akun
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Akun</h1>
        <p className="text-sm text-slate-500">Ubah info akun atau hapus permanen.</p>
      </div>
      <div className="card"><div className="card-bd">
        <EditAccountForm account={account} stats={stats} />
      </div></div>
    </div>
  );
}
