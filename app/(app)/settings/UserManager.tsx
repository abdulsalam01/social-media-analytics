"use client";
import { useState, useTransition } from "react";
import { UserPlus, Trash2, KeyRound, ShieldCheck, ChevronDown, Save } from "lucide-react";
import { createUser, deleteUser, resetPassword, setUserAccountAssignments } from "./actions";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

type Row = { id: number; email: string; name: string; role: string; created_at: string; account_ids: number[] };
type AccountRow = { id: number; name: string; handle: string; platform: string };

export default function UserManager({ users, accounts, meRole, meId }: { users: Row[]; accounts: AccountRow[]; meRole: string; meId: number }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [pass, setPass] = useState("");
  const [assignmentUser, setAssignmentUser] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const isAdmin = meRole === "admin";

  function addUser(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createUser({ email, name, role, password: pass });
      if (!res.ok) return toast("error", res.error);
      toast("success", "Pengguna dibuat!");
      setEmail(""); setName(""); setPass(""); setShow(false);
      router.refresh();
    });
  }

  function onDelete(id: number) {
    if (id === meId) return toast("error", "Tidak bisa hapus akun sendiri.");
    if (!confirm("Yakin hapus pengguna ini?")) return;
    start(async () => {
      const res = await deleteUser(id);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Pengguna dihapus.");
      router.refresh();
    });
  }

  function onReset(id: number) {
    const p = prompt("Password baru (minimal 8 karakter):");
    if (!p || p.length < 8) return;
    start(async () => {
      const res = await resetPassword(id, p);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Password direset.");
    });
  }

  return (
    <div>
      <div className="space-y-2 mb-4">
        {users.map((u) => {
          const assignmentOpen = assignmentUser === u.id;
          return (
            <div key={u.id} className="rounded-lg border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{u.name} {u.id === meId && <span className="text-xs text-slate-400">(kamu)</span>}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email} • <span className="capitalize">{u.role}</span></div>
                  <div className="text-[11px] mt-1 text-brand-600">
                    {u.role === "admin" ? "Semua akun (otomatis)" : `${u.account_ids.length} akun ditugaskan`}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    {u.role !== "admin" && (
                      <button className="btn-ghost !px-2 !py-1.5" onClick={() => setAssignmentUser(assignmentOpen ? null : u.id)} title="Atur akses akun">
                        <ShieldCheck className="w-4 h-4" />
                        <ChevronDown className={`w-3 h-3 transition ${assignmentOpen ? "rotate-180" : ""}`} />
                      </button>
                    )}
                    <button className="btn-ghost !p-1.5" onClick={() => onReset(u.id)} title="Reset password">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button className="btn-ghost !p-1.5 text-red-600 hover:bg-red-50" onClick={() => onDelete(u.id)} title="Hapus" disabled={u.id === meId}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {assignmentOpen && u.role !== "admin" && (
                <AssignmentEditor user={u} accounts={accounts} onClose={() => setAssignmentUser(null)} />
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && !show && (
        <button onClick={() => setShow(true)} className="btn-secondary w-full">
          <UserPlus className="w-4 h-4" /> Tambah Pengguna
        </button>
      )}
      {isAdmin && show && (
        <form onSubmit={addUser} className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="input" type="email" placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Password (min 8)" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={8} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}>
              <option value="viewer">Viewer (hanya lihat)</option>
              <option value="editor">Editor (input data)</option>
              <option value="admin">Admin (semua akses)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setShow(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={pending}>Simpan</button>
          </div>
        </form>
      )}
    </div>
  );
}

function AssignmentEditor({ user, accounts, onClose }: { user: Row; accounts: AccountRow[]; onClose: () => void }) {
  const [selected, setSelected] = useState<number[]>(user.account_ids);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function toggle(accountId: number) {
    setSelected((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]);
  }

  function save() {
    start(async () => {
      const result = await setUserAccountAssignments({ userId: user.id, accountIds: selected });
      if (!result.ok) return toast("error", result.error);
      toast("success", `${result.count} akun ditugaskan ke ${user.name}.`);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-700 mb-2">Pilih akun yang dapat diakses sesuai role pengguna</div>
      {!accounts.length ? (
        <div className="text-xs text-slate-400 py-2">Belum ada akun sosial media.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
          {accounts.map((account) => (
            <label key={account.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-slate-800 truncate">{account.name}</span>
                <span className="block text-[11px] text-slate-500 truncate">{account.platform === "instagram" ? "IG" : "TikTok"} · @{account.handle}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setSelected(selected.length === accounts.length ? [] : accounts.map((account) => account.id))}>
          {selected.length === accounts.length && accounts.length ? "Lepas semua" : "Pilih semua"}
        </button>
        <button type="button" className="btn-primary !py-1.5" disabled={pending} onClick={save}>
          <Save className="w-3.5 h-3.5" /> {pending ? "Menyimpan…" : "Simpan Akses"}
        </button>
      </div>
    </div>
  );
}
