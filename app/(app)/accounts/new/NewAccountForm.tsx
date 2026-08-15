"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccount } from "./actions";
import { useToast } from "@/components/Toast";

export default function NewAccountForm() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createAccount({ name, handle: handle.replace(/^@/, ""), platform });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast("success", "Akun berhasil ditambahkan!");
      router.push("/accounts");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <div>
        <label className="label">Platform</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPlatform("instagram")}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
              platform === "instagram" ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ig-start via-ig-mid to-ig-end grid place-items-center text-white">
              <Instagram className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-900">Instagram</div>
              <div className="text-xs text-slate-500">Feed, Reels, Story</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPlatform("tiktok")}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
              platform === "tiktok" ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-slate-900 grid place-items-center text-white">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-900">TikTok</div>
              <div className="text-xs text-slate-500">Short video</div>
            </div>
          </button>
        </div>
      </div>
      <div>
        <label className="label">Nama Akun / Brand</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: PT Maju Bersama"
          required
        />
        <div className="hint">Nama internal buat identifikasi. Bebas.</div>
      </div>
      <div>
        <label className="label">Handle / Username</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
          <input
            className="input pl-8"
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
            placeholder="maju.bersama"
            required
          />
        </div>
        <div className="hint">Tanpa simbol @.</div>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Akun"}
        </button>
      </div>
    </form>
  );
}
