import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await currentUser();
  const { next } = await searchParams;
  if (u) redirect(next || "/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 grid place-items-center shadow-soft">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">SocmedInsight</div>
            <div className="text-xs text-slate-500">Dashboard Analytics Sosial Media</div>
          </div>
        </div>
        <div className="card">
          <div className="card-bd">
            <h1 className="text-lg font-semibold text-slate-900">Selamat Datang</h1>
            <p className="text-sm text-slate-500 mb-6">Silakan login untuk lanjut ke dashboard.</p>
            <LoginForm nextPath={next} />
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Butuh bantuan? Hubungi admin perusahaan Anda.
        </p>
      </div>
    </div>
  );
}
