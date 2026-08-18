"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { Account, ContentInsight } from "@/lib/db";
import { updateContentInsight, deleteContentInsight } from "@/app/(app)/input/actions";
import { useToast } from "@/components/Toast";
import DateField from "@/components/DateField";

export default function DetailActions({
  content, account, backHref,
}: {
  content: ContentInsight;
  account: Account;
  backHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const isTT = account.platform === "tiktok";

  const [f, setF] = useState({
    post_date: content.post_date,
    title: content.title || "",
    link: content.link || "",
    likes: String(content.likes),
    comments: String(content.comments),
    shares: String(content.shares),
    saves: String(content.saves),
    reposts: String(content.reposts ?? 0),
    follows: String(content.follows),
    reach: String(content.reach),
    impression: String(content.impression),
    plays: String(content.plays),
    profile_visit: String(content.profile_visit),
  });

  function up<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateContentInsight({
        id: content.id,
        account_id: account.id,
        post_date: f.post_date,
        title: f.title || null,
        link: f.link || null,
        profile_visit: Number(f.profile_visit || 0),
        likes: Number(f.likes || 0),
        comments: Number(f.comments || 0),
        shares: Number(f.shares || 0),
        saves: Number(f.saves || 0),
        reposts: Number(f.reposts || 0),
        follows: Number(f.follows || 0),
        reach: Number(f.reach || 0),
        impression: Number(f.impression || 0),
        plays: Number(f.plays || 0),
      });
      if (!res.ok) return toast("error", res.error);
      toast("success", "Konten diperbarui.");
      setEditing(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Hapus konten "${content.title || fmtShort(content.post_date)}" secara permanen?`)) return;
    start(async () => {
      const res = await deleteContentInsight(content.id);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Konten dihapus.");
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/dashboard?account=${account.id}`} className="btn-ghost">
          <LayoutDashboard className="w-4 h-4" /> Dashboard Akun
        </Link>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4" /> Edit Konten
          </button>
          <button className="btn-danger" onClick={onDelete} disabled={pending}>
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
        </div>
      </div>

      {editing && (
        <Modal title="Edit Konten" onClose={() => setEditing(false)}>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <DateField compact label="Tanggal Post" value={f.post_date} onChange={(v) => up("post_date", v)} required />
              </div>
              <div className="col-span-2">
                <label className="label !text-xs">Judul (opsional)</label>
                <input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Promo Ramadan Diskon 50%" maxLength={200} />
              </div>
              <div className="col-span-4">
                <label className="label !text-xs">Link Post</label>
                <input className="input" value={f.link} onChange={(e) => up("link", e.target.value)} placeholder="https://..." />
              </div>
              <NumField label="Like" v={f.likes} on={(v) => up("likes", v)} />
              <NumField label="Comment" v={f.comments} on={(v) => up("comments", v)} />
              <NumField label="Share" v={f.shares} on={(v) => up("shares", v)} />
              <NumField label="Save" v={f.saves} on={(v) => up("saves", v)} />
              <NumField label="Repost" v={f.reposts} on={(v) => up("reposts", v)} />
              {isTT ? (
                <NumField label="Plays" v={f.plays} on={(v) => up("plays", v)} />
              ) : (
                <>
                  <NumField label="Reach" v={f.reach} on={(v) => up("reach", v)} />
                  <NumField label="Impression" v={f.impression} on={(v) => up("impression", v)} />
                  <NumField label="Profile Visit" v={f.profile_visit} on={(v) => up("profile_visit", v)} />
                  <NumField label="Follow" v={f.follows} on={(v) => up("follows", v)} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Batal</button>
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Perubahan"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function NumField({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="label !text-xs">{label}</label>
      <input type="number" min="0" className="input" value={v} onChange={(e) => on(e.target.value)} placeholder="0" />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function fmtShort(iso: string): string {
  return iso;
}
