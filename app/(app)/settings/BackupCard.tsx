"use client";
import { Download } from "lucide-react";

export default function BackupCard() {
  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Download file database (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data.db</code>) sebagai backup.
        Simpan di tempat aman (cloud drive, hard disk eksternal).
      </p>
      <a href="/api/backup" className="btn-primary" download>
        <Download className="w-4 h-4" /> Download Backup Sekarang
      </a>
      <div className="mt-4 text-xs text-slate-500">
        Rekomendasi: backup minimal seminggu sekali. Jadwalkan reminder di kalender.
      </div>
    </div>
  );
}
