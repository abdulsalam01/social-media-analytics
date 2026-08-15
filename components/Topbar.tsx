"use client";
import { LogOut, User as UserIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { doLogout } from "@/app/login/actions";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/session";

export default function Topbar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function onLogout() {
    await doLogout();
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="ml-12 lg:ml-0">
        <div className="text-sm text-slate-500">Halo, {user.name.split(" ")[0]} 👋</div>
        <div className="text-xs text-slate-400">Semoga hari kamu produktif!</div>
      </div>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
        >
          <div className="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center text-sm font-semibold">
            {initials || <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium text-slate-800">{user.name}</div>
            <div className="text-[11px] text-slate-500 capitalize">{user.role}</div>
          </div>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 card">
            <div className="p-3 border-b border-slate-100">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="p-2">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
