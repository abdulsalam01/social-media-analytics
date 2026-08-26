"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, ChevronLeft, ChevronRight, ExternalLink, Calendar, PenSquare, Eye } from "lucide-react";
import type { Account } from "@/lib/db";
import { fmtDate, fmtNum, fmtPct, fmtRelative, fmtDateTime, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import DateField from "@/components/DateField";
import {
  deleteProfileInsight, deleteContentInsight,
  updateProfileInsight, updateContentInsight,
} from "./actions";

type Profile = {
  id: number; date: string; visit_per_day: number; reach_per_day: number;
  followers: number; followers_growth: number; new_followers: number;
  created_at: string; updated_at: string;
};
type Content = {
  id: number; post_date: string; title: string | null; link: string | null; likes: number; comments: number; shares: number; saves: number;
  reposts: number; reach: number; plays: number; engagement: number; engagement_rate: number;
  profile_visit: number; follows: number; impression: number; created_at: string; updated_at: string;
};

export default function EntriesList({
  account,
  profileEntries, profileTotal, profilePage,
  contentEntries, contentTotal, contentPage,
  pageSize,
}: {
  account: Account;
  profileEntries: Profile[];
  profileTotal: number;
  profilePage: number;
  contentEntries: Content[];
  contentTotal: number;
  contentPage: number;
  pageSize: number;
}) {
  const [tab, setTab] = useState<"profile" | "content">("profile");
  const isTT = account.platform === "tiktok";

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className="font-semibold text-slate-900">Data Sudah Diinput</div>
          <div className="text-xs text-slate-500">Edit atau hapus data yang salah.</div>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button onClick={() => setTab("profile")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium", tab === "profile" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600")}>
            <Calendar className="w-3.5 h-3.5 inline mr-1" /> Profil ({fmtNum(profileTotal)})
          </button>
          <button onClick={() => setTab("content")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium", tab === "content" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600")}>
            <PenSquare className="w-3.5 h-3.5 inline mr-1" /> Konten ({fmtNum(contentTotal)})
          </button>
        </div>
      </div>
      <div className="card-bd p-0">
        {tab === "profile" ? (
          <ProfileTable
            account={account}
            entries={profileEntries}
            total={profileTotal}
            page={profilePage}
            pageSize={pageSize}
            isTT={isTT}
          />
        ) : (
          <ContentTable
            account={account}
            entries={contentEntries}
            total={contentTotal}
            page={contentPage}
            pageSize={pageSize}
            isTT={isTT}
          />
        )}
      </div>
    </div>
  );
}

function Pagination({ page, total, pageSize, param }: { page: number; total: number; pageSize: number; param: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  function go(p: number) {
    const params = new URLSearchParams(sp.toString());
    params.set(param, String(p));
    router.push(`/input?${params.toString()}`);
  }
  if (pages <= 1) return null;
  return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <div>Halaman {page} dari {pages} • {fmtNum(total)} data</div>
      <div className="flex gap-1">
        <button className="btn-secondary !py-1 !px-2" onClick={() => go(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button className="btn-secondary !py-1 !px-2" onClick={() => go(page + 1)} disabled={page >= pages}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProfileTable({ account, entries, total, page, pageSize, isTT }: {
  account: Account; entries: Profile[]; total: number; page: number; pageSize: number; isTT: boolean;
}) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function onDelete(id: number) {
    if (!confirm("Yakin hapus data ini?")) return;
    start(async () => {
      const res = await deleteProfileInsight(id);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Data dihapus.");
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return <div className="p-10 text-center text-sm text-slate-400">Belum ada data profil. Input pertama di form atas.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <th className="px-5 py-3">Tanggal</th>
              <th className="px-5 py-3 text-right">Followers</th>
              <th className="px-5 py-3 text-right">+Baru</th>
              <th className="px-5 py-3 text-right">Growth</th>
              <th className="px-5 py-3 text-right">{isTT ? "Video Views" : "Visit"}</th>
              <th className="px-5 py-3 text-right">{isTT ? "Profile Views" : "Reach"}</th>
              <th className="px-5 py-3">Ditambah</th>
              <th className="px-5 py-3">Diubah</th>
              <th className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-2.5 text-slate-700">{fmtDate(e.date)}</td>
                <td className="px-5 py-2.5 text-right font-medium">{fmtNum(e.followers)}</td>
                <td className="px-5 py-2.5 text-right">
                  <span className={cn(
                    "text-xs font-medium",
                    (e.new_followers ?? 0) > 0 ? "text-brand-600" : "text-slate-400"
                  )}>
                    {(e.new_followers ?? 0) > 0 ? "+" : ""}{fmtNum(e.new_followers ?? 0)}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className={cn(
                    "text-xs",
                    e.followers_growth > 0 ? "text-emerald-600" :
                      e.followers_growth < 0 ? "text-red-600" : "text-slate-400"
                  )}>
                    {e.followers_growth > 0 ? "+" : ""}{fmtNum(e.followers_growth)}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right text-slate-600">{fmtNum(e.visit_per_day)}</td>
                <td className="px-5 py-2.5 text-right text-slate-600">{fmtNum(e.reach_per_day)}</td>
                <td className="px-5 py-2.5 text-xs text-slate-500" title={fmtDateTime(e.created_at)}>{fmtRelative(e.created_at)}</td>
                <td className="px-5 py-2.5 text-xs text-slate-500" title={fmtDateTime(e.updated_at)}>
                  {e.updated_at !== e.created_at ? fmtRelative(e.updated_at) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(e)} className="btn-ghost !p-1.5 text-brand-600" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(e.id)} disabled={pending} className="btn-ghost !p-1.5 text-red-600 hover:bg-red-50" title="Hapus">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} param="p" />
      {editing && (
        <EditProfileModal
          account={account}
          entry={editing}
          isTT={isTT}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditProfileModal({ account, entry, isTT, onClose }: { account: Account; entry: Profile; isTT: boolean; onClose: () => void }) {
  const [date, setDate] = useState(entry.date);
  const [visit, setVisit] = useState(String(entry.visit_per_day));
  const [reach, setReach] = useState(String(entry.reach_per_day));
  const [followers, setFollowers] = useState(String(entry.followers));
  const [newFollowers, setNewFollowers] = useState(String(entry.new_followers ?? 0));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfileInsight({
        id: entry.id,
        account_id: account.id,
        date,
        visit_per_day: Number(visit || 0),
        reach_per_day: Number(reach || 0),
        new_followers: Number(newFollowers || 0),
        followers: Number(followers || 0),
      });
      if (!res.ok) return toast("error", res.error);
      toast("success", "Data diperbarui.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal onClose={onClose} title="Edit Data Profil Harian">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DateField compact label="Tanggal" value={date} onChange={setDate} required />
          <div><label className="label !text-xs">Followers</label><input type="number" min="0" className="input" value={followers} onChange={(e) => setFollowers(e.target.value)} /></div>
          <div><label className="label !text-xs">Penambahan Follower</label><input type="number" min="0" className="input" value={newFollowers} onChange={(e) => setNewFollowers(e.target.value)} /></div>
          <div><label className="label !text-xs">{isTT ? "Video Views" : "Visit Per Day"}</label><input type="number" min="0" className="input" value={visit} onChange={(e) => setVisit(e.target.value)} /></div>
          <div><label className="label !text-xs">{isTT ? "Profile Views" : "Reach Per Day"}</label><input type="number" min="0" className="input" value={reach} onChange={(e) => setReach(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ContentTable({ account, entries, total, page, pageSize, isTT }: {
  account: Account; entries: Content[]; total: number; page: number; pageSize: number; isTT: boolean;
}) {
  const [editing, setEditing] = useState<Content | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function onDelete(id: number) {
    if (!confirm("Yakin hapus konten ini?")) return;
    start(async () => {
      const res = await deleteContentInsight(id);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Konten dihapus.");
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return <div className="p-10 text-center text-sm text-slate-400">Belum ada konten diinput. Tambah di tab Data Konten atas.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <th className="px-5 py-3">Tanggal</th>
              <th className="px-5 py-3">Judul</th>
              <th className="px-5 py-3 text-right">Eng</th>
              <th className="px-5 py-3 text-right">ER</th>
              <th className="px-5 py-3 text-right">{isTT ? "Plays" : "Reach"}</th>
              <th className="px-5 py-3">Ditambah</th>
              <th className="px-5 py-3">Diubah</th>
              <th className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const detailHref = `/content/${e.id}?from=${encodeURIComponent(`/input?account=${account.id}`)}`;
              return (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-2.5 text-slate-700 whitespace-nowrap">{fmtDate(e.post_date)}</td>
                  <td className="px-5 py-2.5 max-w-[220px]">
                    <Link href={detailHref} className="block hover:underline">
                      {e.title ? (
                        <span className="text-brand-700 font-medium truncate block" title={e.title}>{e.title}</span>
                      ) : <span className="text-slate-400 text-xs italic">Tanpa judul (lihat detail)</span>}
                    </Link>
                    {e.link && (
                      <a href={e.link} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="text-[10px] text-slate-500 hover:text-brand-600 hover:underline inline-flex items-center gap-0.5 mt-0.5">
                        Buka post <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold">{fmtNum(e.engagement)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{fmtPct(e.engagement_rate)}</td>
                  <td className="px-5 py-2.5 text-right">{fmtNum(isTT ? e.plays : e.reach)}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-500" title={fmtDateTime(e.created_at)}>{fmtRelative(e.created_at)}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-500" title={fmtDateTime(e.updated_at)}>
                    {e.updated_at !== e.created_at ? fmtRelative(e.updated_at) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <Link href={detailHref} className="btn-ghost !p-1.5 text-brand-600 inline-flex" title="Lihat detail">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={() => setEditing(e)} className="btn-ghost !p-1.5 text-brand-600" title="Edit cepat">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(e.id)} disabled={pending} className="btn-ghost !p-1.5 text-red-600 hover:bg-red-50" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} param="c" />
      {editing && (
        <EditContentModal
          account={account}
          entry={editing}
          isTT={isTT}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditContentModal({ account, entry, isTT, onClose }: { account: Account; entry: Content; isTT: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    post_date: entry.post_date, title: entry.title || "", link: entry.link || "",
    likes: String(entry.likes), comments: String(entry.comments),
    shares: String(entry.shares), saves: String(entry.saves),
    reposts: String(entry.reposts ?? 0),
    follows: String(entry.follows), reach: String(entry.reach),
    impression: String(entry.impression), plays: String(entry.plays),
    profile_visit: String(entry.profile_visit),
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function up<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateContentInsight({
        id: entry.id,
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
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal onClose={onClose} title="Edit Konten">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2"><DateField compact label="Tanggal Post" value={f.post_date} onChange={(v) => up("post_date", v)} required /></div>
          <div className="col-span-2"><label className="label !text-xs">Judul (opsional)</label><input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Promo Ramadan Diskon 50%" maxLength={200} /></div>
          <div className="col-span-4"><label className="label !text-xs">Link</label><input className="input" value={f.link} onChange={(e) => up("link", e.target.value)} placeholder="https://..." /></div>
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
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>
    </Modal>
  );
}

function NumField({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div><label className="label !text-xs">{label}</label>
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
