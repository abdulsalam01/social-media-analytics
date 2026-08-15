import { currentUser } from "@/lib/session";
import { dbAll, dbGet } from "@/lib/db";
import UserManager from "./UserManager";
import BackupCard from "./BackupCard";
import DangerZone from "./DangerZone";
import { Shield, Database, Users, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await currentUser();
  const users = await dbAll<{ id: number; email: string; name: string; role: string; created_at: string }>(
    "SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC"
  );
  const stats = (await dbGet<{ accounts: number; profile: number; content: number; demographics: number; audit_log: number; login_attempts: number }>(
    `SELECT
       (SELECT COUNT(*) FROM accounts)          AS accounts,
       (SELECT COUNT(*) FROM profile_insight)   AS profile,
       (SELECT COUNT(*) FROM content_insight)   AS content,
       (SELECT COUNT(*) FROM demographics)      AS demographics,
       (SELECT COUNT(*) FROM audit_log)         AS audit_log,
       (SELECT COUNT(*) FROM login_attempts)    AS login_attempts`
  ))!;
  const auditRows = await dbAll<{ at: string; action: string; entity: string; entity_id: number | null; user_name: string | null }>(
    "SELECT a.at, a.action, a.entity, a.entity_id, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.at DESC LIMIT 30"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>
        <p className="text-sm text-slate-500">Kelola pengguna, backup database, dan lihat log aktivitas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-hd">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-brand-600" /><span className="font-semibold">Pengguna</span></div>
          </div>
          <div className="card-bd">
            <UserManager users={users} meRole={me?.role || "viewer"} meId={me?.id || 0} />
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <div className="flex items-center gap-2"><Database className="w-4 h-4 text-brand-600" /><span className="font-semibold">Backup Database</span></div>
          </div>
          <div className="card-bd">
            <BackupCard />
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-hd">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-600" /><span className="font-semibold">Aktivitas Terakhir</span></div>
            <span className="text-xs text-slate-500">30 log terakhir</span>
          </div>
          <div className="card-bd p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-2">Waktu</th>
                  <th className="px-5 py-2">Pengguna</th>
                  <th className="px-5 py-2">Aksi</th>
                  <th className="px-5 py-2">Entitas</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">Belum ada aktivitas.</td></tr>
                )}
                {auditRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-5 py-2 text-slate-500">{r.at}</td>
                    <td className="px-5 py-2 text-slate-700">{r.user_name || <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-2"><span className="badge-blue">{r.action}</span></td>
                    <td className="px-5 py-2 text-slate-600">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-bd flex items-start gap-3">
          <Shield className="w-5 h-5 text-brand-600 mt-0.5" />
          <div className="text-sm text-slate-600">
            <div className="font-semibold text-slate-900 mb-1">Tips Keamanan</div>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li>Ganti password default admin setelah instalasi pertama.</li>
              <li>Backup database secara rutin (minimal seminggu sekali).</li>
              <li>Batasi role editor/viewer untuk staf yang tidak butuh akses penuh.</li>
              <li>Deploy dibalik HTTPS (Caddy/Nginx reverse proxy) di production.</li>
            </ul>
          </div>
        </div>
      </div>

      {me?.role === "admin" && <DangerZone stats={stats} />}
    </div>
  );
}
