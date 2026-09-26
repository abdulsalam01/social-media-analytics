"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flag, Instagram, Music2, Trash2, Save, AlertTriangle, TrendingDown, TrendingUp, Users } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { updateAccount, deleteAccount } from "../../actions";
import { useToast } from "@/components/Toast";
import type { Account } from "@/lib/db";
import { calculateFollowerImpact } from "@/lib/follower-impact";

export default function EditAccountForm({
  account,
  stats,
  canDelete,
}: {
  account: Account;
  stats: { profile_rows: number; content_rows: number; latest_followers: number | null };
  canDelete: boolean;
}) {
  const [name, setName] = useState(account.name);
  const [handle, setHandle] = useState(account.handle);
  const [platform, setPlatform] = useState<"instagram" | "tiktok">(account.platform);
  const [initialFollowers, setInitialFollowers] = useState(String(account.initial_followers));
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const totalRows = stats.profile_rows + stats.content_rows;
  const followerImpact = calculateFollowerImpact(Number(initialFollowers || 0), stats.latest_followers);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateAccount({
        id: account.id,
        name,
        handle: handle.replace(/^@/, ""),
        platform,
        initial_followers: Number(initialFollowers || 0),
      });
      if (!res.ok) return toast("error", res.error);
      toast("success", "Akun diperbarui!");
      router.push("/accounts");
      router.refresh();
    });
  }

  function onDelete() {
    if (confirm !== account.handle) {
      toast("error", `Ketik "${account.handle}" untuk konfirmasi.`);
      return;
    }
    start(async () => {
      const res = await deleteAccount(account.id);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Akun dihapus.");
      router.push("/accounts");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSave} className="space-y-5">
        <div>
          <label className="label">Platform</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlatform("instagram")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                platform === "instagram" ? "border-brand-500 bg-brand-50" : "border-slate-200"
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ig-start via-ig-mid to-ig-end grid place-items-center text-white">
                <Instagram className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-900">Instagram</span>
            </button>
            <button
              type="button"
              onClick={() => setPlatform("tiktok")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                platform === "tiktok" ? "border-brand-500 bg-brand-50" : "border-slate-200"
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center text-white">
                <Music2 className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-900">TikTok</span>
            </button>
          </div>
        </div>
        <div>
          <label className="label">Nama Akun / Brand</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Handle / Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
            <input
              className="input pl-8"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              required
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-emerald-50/40">
          <div className="flex items-start gap-3 border-b border-brand-100/70 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Flag className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="initial-followers">Initial Followers</label>
              <input
                id="initial-followers"
                type="number"
                min="0"
                max="2147483647"
                step="1"
                inputMode="numeric"
                className="input bg-white"
                value={initialFollowers}
                onChange={(e) => setInitialFollowers(e.target.value)}
                required
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Baseline saat kamu mulai mengelola akun. Mengubahnya langsung menyesuaikan laporan dampak, tanpa menulis ulang histori harian.
              </p>
            </div>
          </div>
          {followerImpact.enabled ? (
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 px-4 py-3 text-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Awal</div>
                <div className="mt-1 font-bold tabular-nums text-slate-900">{fmtNum(followerImpact.initialFollowers)}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sekarang</div>
                <div className="mt-1 font-bold tabular-nums text-slate-900">{fmtNum(followerImpact.currentFollowers)}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dampak</div>
                <div className={cn("mt-1 inline-flex items-center gap-1 font-bold tabular-nums", followerImpact.impact >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {followerImpact.impact >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {followerImpact.impact > 0 ? "+" : ""}{fmtNum(followerImpact.impact)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <Users className="h-4 w-4 text-slate-400" /> Isi lebih dari 0 untuk mengaktifkan tracking dampak follower.
            </div>
          )}
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          <Save className="w-4 h-4" /> {pending ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
      </form>

      {canDelete && <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-red-900">Zona Berbahaya</div>
            <div className="text-sm text-red-700 mt-1">
              Hapus akun ini akan menghilangkan{" "}
              <b>{fmtNum(totalRows)} data</b> ({fmtNum(stats.profile_rows)} data profil,{" "}
              {fmtNum(stats.content_rows)} konten) secara permanen.
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label !text-xs">Ketik <code className="bg-white px-1 py-0.5 rounded">{account.handle}</code> untuk konfirmasi</label>
                <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={account.handle} />
              </div>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending || confirm !== account.handle}
                className="btn-danger"
              >
                <Trash2 className="w-4 h-4" /> Hapus Akun Permanen
              </button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
