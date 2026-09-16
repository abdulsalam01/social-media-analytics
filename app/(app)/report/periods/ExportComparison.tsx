"use client";

import { Download } from "lucide-react";
import { buildComparisonCsv, type ComparisonBasis, type ComparisonMetric, type ComparisonRange } from "@/lib/report-comparison";

export default function ExportComparison({ accountName, accountId, range1, range2, basis, metrics }: {
  accountName: string;
  accountId: number;
  range1: ComparisonRange;
  range2: ComparisonRange;
  basis: ComparisonBasis;
  metrics: ComparisonMetric[];
}) {
  function download() {
    const csv = buildComparisonCsv(accountName, range1, range2, basis, metrics);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `laporan-${accountId}-${range1.from}-${range1.to}-vs-${range2.from}-${range2.to}-${basis}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <button type="button" className="btn-secondary" onClick={download}><Download className="w-4 h-4" /> Ekspor CSV</button>;
}
