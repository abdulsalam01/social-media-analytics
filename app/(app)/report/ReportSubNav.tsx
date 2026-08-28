"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/report", label: "Ringkasan", icon: BarChart3 },
  { href: "/report/advanced", label: "Bandingkan Konten", icon: GitCompare },
];

export default function ReportSubNav() {
  const path = usePathname();
  const sp = useSearchParams();
  const account = sp.get("account");
  const qs = account ? `?account=${account}` : "";

  return (
    <div className="no-print inline-flex rounded-lg bg-slate-100 p-1">
      {items.map((it) => {
        const active = path === it.href;
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={`${it.href}${qs}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
              active ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
