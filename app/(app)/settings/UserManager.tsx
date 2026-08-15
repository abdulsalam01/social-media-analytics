"use client";
import { useState, useTransition } from "react";
import { UserPlus, Trash2, KeyRound } from "lucide-react";
import { createUser, deleteUser, resetPassword } from "./actions";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

type Row = { id: number; email: string; name: string; role: string; created_at: string };

export default function UserManager({ users, meRole, meId }: { users: Row[]; meRole: string; meId: number }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [pass, setPass] = useState("");
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
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50/50">
            <div>
              <div className="text-sm font-medium text-slate-900">{u.name} {u.id === meId && <span className="text-xs text-slate-400">(kamu)</span>}</div>
              <div className="text-xs text-slate-500">{u.email} • <span className="capitalize">{u.role}</span></div>
            </div>
            {isAdmin && (
              <div className="flex gap-1">
                <button className="btn-ghost !p-1.5" onClick={() => onReset(u.id)} title="Reset password">
                  <KeyRound className="w-4 h-4" />
                </button>
                <button className="btn-ghost !p-1.5 text-red-600 hover:bg-red-50" onClick={() => onDelete(u.id)} title="Hapus" disabled={u.id === meId}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
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
