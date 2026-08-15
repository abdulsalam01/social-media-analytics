import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="card">
      <div className="card-bd text-center py-16">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
        {ctaHref && ctaLabel && (
          <Link href={ctaHref} className="btn-primary mt-6 inline-flex">
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
