import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageRole } from "@/lib/session";
import NewAccountForm from "./NewAccountForm";

export default async function NewAccountPage() {
  await requirePageRole(["admin", "editor"]);
  return (
    <div className="max-w-xl space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar akun
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tambah Akun Sosmed Baru</h1>
        <p className="text-sm text-slate-500">Setiap akun bisa punya laporan sendiri.</p>
      </div>
      <div className="card"><div className="card-bd"><NewAccountForm /></div></div>
    </div>
  );
}
