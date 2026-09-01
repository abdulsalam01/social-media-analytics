"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Account } from "@/lib/db";
import { ACTIVE_ACCOUNT_COOKIE, ACTIVE_ACCOUNT_COOKIE_MAX_AGE } from "@/lib/account-selection";

function persistAccount(id: number | string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=${encodeURIComponent(String(id))}; Path=/; Max-Age=${ACTIVE_ACCOUNT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

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

  useEffect(() => {
    persistAccount(current);
  }, [current]);

  function onChange(id: string) {
    persistAccount(id);
    const params = new URLSearchParams(sp.toString());
    params.set("account", id);
    params.delete("p");
    params.delete("c");
    params.delete("ids");
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
