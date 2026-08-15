"use client";
import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

const Ctx = createContext<{ push: (kind: ToastKind, text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 no-print">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 rounded-lg bg-white border border-slate-200 shadow-lg px-4 py-3 max-w-sm"
          >
            {t.kind === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />}
            {t.kind === "error" && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
            {t.kind === "info" && <Info className="w-5 h-5 text-brand-600 mt-0.5" />}
            <div className="text-sm text-slate-800">{t.text}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast harus di dalam ToastProvider");
  return ctx.push;
}
