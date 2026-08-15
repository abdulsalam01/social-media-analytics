import Link from "next/link";
import { Plus, Instagram, Music2 } from "lucide-react";
import { dbAll, Account } from "@/lib/db";
import PlatformBadge from "@/components/PlatformBadge";
import EmptyState from "@/components/EmptyState";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await dbAll<Account>("SELECT * FROM accounts ORDER BY created_at DESC");

  const igCount = accounts.filter((a) => a.platform === "instagram").length;
  const ttCount = accounts.filter((a) => a.platform === "tiktok").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Akun Sosmed</h1>
          <p className="text-sm text-slate-500">Daftar akun sosial media yang kamu kelola.</p>
        </div>
        <Link href="/accounts/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Tambah Akun
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card"><div className="card-bd"><div className="text-xs text-slate-500">Total Akun</div><div className="text-2xl font-bold mt-1">{accounts.length}</div></div></div>
        <div className="card"><div className="card-bd flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ig-start via-ig-mid to-ig-end grid place-items-center text-white"><Instagram className="w-5 h-5" /></div>
          <div><div className="text-xs text-slate-500">Instagram</div><div className="text-xl font-bold">{igCount}</div></div>
        </div></div>
        <div className="card"><div className="card-bd flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center text-white"><Music2 className="w-5 h-5" /></div>
          <div><div className="text-xs text-slate-500">TikTok</div><div className="text-xl font-bold">{ttCount}</div></div>
        </div></div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="Belum ada akun terdaftar"
          description="Tambah akun sosmed pertamamu untuk mulai mencatat performa mingguan."
          ctaHref="/accounts/new"
          ctaLabel="Tambah Akun Sekarang"
        />
      ) : (
        <div className="card">
          <div className="card-bd p-0">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Handle</th>
                  <th className="px-5 py-3">Ditambahkan</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-medium text-slate-900">{a.name}</td>
                    <td className="px-5 py-4"><PlatformBadge platform={a.platform} /></td>
                    <td className="px-5 py-4 text-slate-600">@{a.handle}</td>
                    <td className="px-5 py-4 text-slate-500 text-sm">{fmtDate(a.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/dashboard?account=${a.id}`} className="btn-ghost !py-1 !px-2 text-xs">Dashboard</Link>
                      <Link href={`/input?account=${a.id}`} className="btn-secondary !py-1 !px-2 text-xs ml-2">Input</Link>
                      <Link href={`/accounts/${a.id}/edit`} className="btn-secondary !py-1 !px-2 text-xs ml-2">Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
