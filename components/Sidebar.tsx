"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, PencilLine, FileBarChart2, Settings, HelpCircle, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Ringkasan performa" },
  { href: "/accounts", label: "Akun Sosmed", icon: Users, hint: "Kelola akun" },
  { href: "/input", label: "Input Data", icon: PencilLine, hint: "Masukin data mingguan" },
  { href: "/compare", label: "Bandingkan Brand", icon: GitCompareArrows, hint: "Head-to-head brand" },
  { href: "/report", label: "Laporan", icon: FileBarChart2, hint: "Report mingguan + PDF" },
  { href: "/settings", label: "Pengaturan", icon: Settings, hint: "Pengguna, backup" },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="lg:hidden fixed top-3 left-3 z-40 btn-secondary !p-2 no-print"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40 no-print" onClick={() => setOpen(false)} />
      )}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-40 transform transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 grid place-items-center shadow-sm">
            <span className="text-white font-bold">S</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">SocmedInsight</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Analytics</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", active ? "text-brand-600" : "text-slate-400")} />
                <div>
                  <div className="font-medium">{n.label}</div>
                  <div className="text-[11px] text-slate-500">{n.hint}</div>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3">
          <Link
            href="/help"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
          >
            <HelpCircle className="w-4 h-4" />
            Panduan pemakaian
          </Link>
        </div>
      </aside>
    </>
  );
}
