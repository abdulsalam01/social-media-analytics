"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { Account } from "@/lib/db";

export default function AccountPicker({
  accounts,
  current,
  basePath,
}: {
  accounts: Account[];
  current: number;
  basePath: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  function onChange(id: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("account", id);
    router.push(`${basePath}?${params.toString()}`);
  }
  return (
    <select className="input !w-auto pr-8" value={current} onChange={(e) => onChange(e.target.value)}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.platform === "instagram" ? "IG" : "TT"} @{a.handle})
        </option>
      ))}
    </select>
  );
}
