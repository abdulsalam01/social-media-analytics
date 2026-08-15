"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { doLogin } from "./actions";

export default function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await doLogin({ email, password, next: nextPath });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.redirect);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          required
          autoFocus
          className="input"
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            required
            className="input pr-20"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-600 hover:text-brand-700 px-2 py-1"
            onClick={() => setShowPass((v) => !v)}
          >
            {showPass ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
