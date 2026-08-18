"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Info, Plus, Trash2 } from "lucide-react";
import { saveContentRows } from "./actions";
import { useToast } from "@/components/Toast";
import type { Account } from "@/lib/db";
import { todayISO } from "@/lib/utils";
import DateField from "@/components/DateField";

type Row = {
  post_date: string;
  title: string;
  link: string;
  profile_visit: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  reposts: string;
  follows: string;
  reach: string;
  impression: string;
  plays: string;
};

const emptyRow = (): Row => ({
  post_date: todayISO(),
  title: "",
  link: "",
  profile_visit: "",
  likes: "",
  comments: "",
  shares: "",
  saves: "",
  reposts: "",
  follows: "",
  reach: "",
  impression: "",
  plays: "",
});

export default function ContentForm({ account }: { account: Account }) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const isTT = account.platform === "tiktok";

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = rows.map((r) => ({
        account_id: account.id,
        post_date: r.post_date,
        title: r.title || null,
        link: r.link || null,
        profile_visit: Number(r.profile_visit || 0),
        likes: Number(r.likes || 0),
        comments: Number(r.comments || 0),
        shares: Number(r.shares || 0),
        saves: Number(r.saves || 0),
        reposts: Number(r.reposts || 0),
        follows: Number(r.follows || 0),
        reach: Number(r.reach || 0),
        impression: Number(r.impression || 0),
        plays: Number(r.plays || 0),
      }));
      const res = await saveContentRows(payload);
      if (!res.ok) return toast("error", res.error);
      toast("success", `${res.count} konten tersimpan!`);
      setRows([emptyRow()]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Buka insight tiap konten yang dipost dan input angkanya. Bisa tambah beberapa konten sekaligus.
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-700">Konten #{i + 1}</div>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="btn-ghost !p-1 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <DateField
                compact
                label="Tanggal Post"
                value={r.post_date}
                onChange={(v) => updateRow(i, { post_date: v })}
                required
              />
              <div className="lg:col-span-3">
                <label className="label !text-xs">Judul Konten <span className="text-slate-400 font-normal">(opsional, buat gampang dilacak)</span></label>
                <input className="input" value={r.title} onChange={(e) => updateRow(i, { title: e.target.value })} placeholder="Contoh: Promo Ramadan Diskon 50%" maxLength={200} />
              </div>
              <div className="lg:col-span-4">
                <label className="label !text-xs">Link Konten (opsional)</label>
                <input className="input" value={r.link} onChange={(e) => updateRow(i, { link: e.target.value })} placeholder="https://..." />
              </div>
              <NumField label="Like" value={r.likes} onChange={(v) => updateRow(i, { likes: v })} />
              <NumField label="Comment" value={r.comments} onChange={(v) => updateRow(i, { comments: v })} />
              <NumField label="Share" value={r.shares} onChange={(v) => updateRow(i, { shares: v })} />
              <NumField label="Save" value={r.saves} onChange={(v) => updateRow(i, { saves: v })} />
              <NumField label="Repost" value={r.reposts} onChange={(v) => updateRow(i, { reposts: v })} />
              {isTT ? (
                <NumField label="Play (Video Plays)" value={r.plays} onChange={(v) => updateRow(i, { plays: v })} />
              ) : (
                <>
                  <NumField label="Reach" value={r.reach} onChange={(v) => updateRow(i, { reach: v })} />
                  <NumField label="Impression" value={r.impression} onChange={(v) => updateRow(i, { impression: v })} />
                  <NumField label="Profile Visit" value={r.profile_visit} onChange={(v) => updateRow(i, { profile_visit: v })} />
                  <NumField label="Follow" value={r.follows} onChange={(v) => updateRow(i, { follows: v })} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={addRow} className="btn-secondary">
          <Plus className="w-4 h-4" /> Tambah Konten
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          <Save className="w-4 h-4" />
          {pending ? "Menyimpan…" : `Simpan ${rows.length} Konten`}
        </button>
      </div>
    </form>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label !text-xs">{label}</label>
      <input type="number" min="0" className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    </div>
  );
}
