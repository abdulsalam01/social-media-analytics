import type { Platform } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function PlatformBadge({ platform, size = "sm" }: { platform: Platform; size?: "sm" | "md" }) {
  const isIG = platform === "instagram";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
        isIG
          ? "bg-gradient-to-r from-ig-start via-ig-mid to-ig-end text-white"
          : "bg-slate-900 text-white"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", isIG ? "bg-white" : "bg-tt-cyan")} />
      {isIG ? "Instagram" : "TikTok"}
    </span>
  );
}
