"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Info } from "lucide-react";
import { saveProfileInsight } from "./actions";
import { useToast } from "@/components/Toast";
import type { Account } from "@/lib/db";
import { todayISO, cn } from "@/lib/utils";
import DateField from "@/components/DateField";

export default function ProfileForm({ account }: { account: Account }) {
  const [date, setDate] = useState(todayISO());
  const [visit, setVisit] = useState("");
  const [reach, setReach] = useState("");
  const [delta, setDelta] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const isTT = account.platform === "tiktok";
  const deltaNum = Number(delta || 0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveProfileInsight({
        account_id: account.id,
        date,
        visit_per_day: Number(visit || 0),
        reach_per_day: Number(reach || 0),
        new_followers: deltaNum,
      });
      if (!res.ok) return toast("error", res.error);
      toast("success", `Data ${date} tersimpan!`);
      setVisit("");
      setReach("");
      setDelta("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Buka {account.platform === "instagram" ? "Instagram → Insight → Overview" : "TikTok → Analytics → Overview"} lalu catat angka harian dari tanggal yang dipilih.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField
          label="Tanggal"
          value={date}
          onChange={setDate}
          required
          hint="Pilih tanggal (bukan ketik manual)."
        />
        <div className="sm:col-span-2">
          <label className="label">Penambahan / Pengurangan Follower Hari Ini</label>
          <input
            type="number"
            className="input"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="Contoh: 15 (nambah), -3 (kurang)"
          />
          <div className="hint">
            Isi angka <b>positif</b> jika followers bertambah, <b>negatif</b> jika berkurang.
            Total followers otomatis dihitung dari akumulasi harian.
            {deltaNum !== 0 && (
              <span className={cn(
                "ml-2 font-medium",
                deltaNum > 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {deltaNum > 0 ? "+" : ""}{deltaNum} follower
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="label">{isTT ? "Video Views Per Day" : "Visit Per Day"}</label>
          <input type="number" min="0" className="input" value={visit} onChange={(e) => setVisit(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="label">{isTT ? "Profile Views Per Day" : "Reach Per Day"}</label>
          <input type="number" min="0" className="input" value={reach} onChange={(e) => setReach(e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          <Save className="w-4 h-4" />
          {pending ? "Menyimpan…" : "Simpan Data Hari Ini"}
        </button>
      </div>
    </form>
  );
}
