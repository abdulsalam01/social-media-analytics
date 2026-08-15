"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, RotateCcw, Database } from "lucide-react";
import { resetAllData, clearLogs } from "./actions";
import { useToast } from "@/components/Toast";
import { fmtNum } from "@/lib/utils";

type Stats = {
  accounts: number; profile: number; content: number; demographics: number;
  audit_log: number; login_attempts: number;
};

export default function DangerZone({ stats }: { stats: Stats }) {
  const [pending, start] = useTransition();
  const [phrase, setPhrase] = useState("");
  const [logScope, setLogScope] = useState<"all" | "audit" | "login">("all");
  const toast = useToast();
  const router = useRouter();

  const totalData = stats.accounts + stats.profile + stats.content + stats.demographics;
  const totalLogs = stats.audit_log + stats.login_attempts;

  function onResetData() {
    if (phrase !== "RESET SEMUA DATA") {
      toast("error", `Ketik "RESET SEMUA DATA" persis buat konfirmasi.`);
      return;
    }
    if (!confirm(`Yakin hapus ${fmtNum(totalData)} data (akun, profil, konten)? Pengguna TIDAK dihapus. Aksi ini tidak bisa di-undo.`)) return;
    start(async () => {
      const res = await resetAllData(phrase);
      if (!res.ok) return toast("error", res.error);
      toast("success", "Semua data ter-reset. Sistem fresh.");
      setPhrase("");
      router.refresh();
    });
  }

  function onClearLogs() {
    const label = logScope === "all" ? "audit log + login attempts" : logScope === "audit" ? "audit log" : "login attempts";
    if (!confirm(`Bersihkan ${label} (total ${fmtNum(logScope === "all" ? totalLogs : logScope === "audit" ? stats.audit_log : stats.login_attempts)} baris)?`)) return;
    start(async () => {
      const res = await clearLogs(logScope);
      if (!res.ok) return toast("error", "Gagal bersihkan log");
      toast("success", "Log dibersihkan + storage direclaim.");
      router.refresh();
    });
  }

  return (
    <div className="card border-red-200">
      <div className="card-hd bg-red-50/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="font-semibold text-red-900">Zona Berbahaya (Admin Only)</span>
        </div>
        <span className="text-xs text-red-700">Aksi permanen, tidak bisa di-undo</span>
      </div>
      <div className="card-bd space-y-6">
        {/* Log cleanup */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 grid place-items-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">Bersihkan Log Sistem</div>
              <div className="text-sm text-slate-600 mt-0.5">Hapus catatan audit + login attempts. Berguna kalau storage mulai berat.</div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500" />
                  <span>Audit log: <b>{fmtNum(stats.audit_log)}</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Login attempts: <b>{fmtNum(stats.login_attempts)}</b></span>
                </div>
              </div>
              <div className="mt-4 flex items-end gap-2 flex-wrap">
                <div>
                  <label className="label !text-xs">Pilih Cakupan</label>
                  <select className="input !w-auto" value={logScope} onChange={(e) => setLogScope(e.target.value as "all" | "audit" | "login")}>
                    <option value="all">Semua Log</option>
                    <option value="audit">Audit Log Saja</option>
                    <option value="login">Login Attempts Saja</option>
                  </select>
                </div>
                <button
                  onClick={onClearLogs}
                  disabled={pending || totalLogs === 0}
                  className="btn-secondary !border-amber-300 !text-amber-800 hover:!bg-amber-50"
                >
                  <Trash2 className="w-4 h-4" /> Bersihkan {logScope === "all" ? "Semua" : logScope === "audit" ? "Audit" : "Login"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reset all data */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 grid place-items-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-red-900">Reset Semua Data (Mulai Fresh)</div>
              <div className="text-sm text-red-700 mt-0.5">
                Hapus <b>semua akun sosmed, data profil, konten, demografik</b>.
                Pengguna sistem <b>TIDAK</b> dihapus. Setelah reset, sistem seperti baru instalasi.
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <StatChip label="Akun" value={stats.accounts} />
                <StatChip label="Data Profil" value={stats.profile} />
                <StatChip label="Konten" value={stats.content} />
                <StatChip label="Demografik" value={stats.demographics} />
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="label !text-xs">
                    Ketik <code className="bg-white px-1.5 py-0.5 rounded border border-red-200 text-red-800">RESET SEMUA DATA</code> untuk konfirmasi
                  </label>
                  <input
                    className="input"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    placeholder="RESET SEMUA DATA"
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={onResetData}
                  disabled={pending || phrase !== "RESET SEMUA DATA" || totalData === 0}
                  className="btn-danger"
                >
                  <RotateCcw className="w-4 h-4" />
                  {pending ? "Menghapus…" : `Reset ${fmtNum(totalData)} Data Sekarang`}
                </button>
              </div>
              <div className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
                <Database className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  Setelah reset, database di-VACUUM otomatis biar file size kembali kecil.
                  Backup dulu via tombol Download kalau perlu simpan snapshot.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white border border-red-200 px-3 py-2">
      <div className="text-[10px] uppercase text-red-600">{label}</div>
      <div className="text-sm font-bold text-red-900">{fmtNum(value)}</div>
    </div>
  );
}
