"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ProfileForm from "./ProfileForm";
import ContentForm from "./ContentForm";
import type { Account } from "@/lib/db";
import { Calendar, PenSquare } from "lucide-react";

const tabs = [
  { id: "profile" as const, label: "Data Profil Harian", icon: Calendar, hint: "Followers, reach, visit per hari" },
  { id: "content" as const, label: "Data Konten", icon: PenSquare, hint: "Like, comment, share tiap post" },
];

export default function InputTabs({ account }: { account: Account }) {
  const [active, setActive] = useState<"profile" | "content">("profile");
  return (
    <div>
      <div className="card">
        <div className="card-bd p-0">
          <div className="flex border-b border-slate-100">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "flex-1 flex items-center gap-3 px-5 py-4 transition-colors border-b-2",
                    isActive
                      ? "border-brand-600 bg-brand-50/30 text-brand-700"
                      : "border-transparent text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive ? "text-brand-600" : "text-slate-400")} />
                  <div className="text-left">
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-[11px] text-slate-500">{t.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-5">
            {active === "profile" ? <ProfileForm account={account} /> : <ContentForm account={account} />}
          </div>
        </div>
      </div>
    </div>
  );
}
