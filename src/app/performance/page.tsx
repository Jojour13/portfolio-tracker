"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Share2, X, Loader2, Download } from "lucide-react";
import { useFolio } from "@/lib/store";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/hooks/useHistory";
import { sliceWindow } from "@/lib/history";
import { dailyReturns } from "@/lib/performance";
import { computeMetrics } from "@/lib/metrics";
import { pickMessage } from "@/lib/messages";
import { captureNode, shareOrDownload } from "@/lib/share";
import { relevantBenchmarks, buildComparison } from "@/lib/benchmark";
import { PerformanceChart } from "@/components/PerformanceChart";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ShareCard } from "@/components/ShareCard";
import { Money } from "@/components/Money";
import { Card, Button } from "@/components/ui";
import { formatPercent, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

const TFS = [
  { k: "3d", label: "3D" },
  { k: "7d", label: "7D" },
  { k: "ytd", label: "YTD" },
  { k: "1y", label: "1Y" },
  { k: "5y", label: "5Y" },
];

export default function PerformancePage() {
  const hydrated = useFolio((s) => s.hydrated);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const settings = useFolio((s) => s.settings);
  const censored = useFolio((s) => s.censored);
  const { snapshot, base, ratesPerUsd } = usePortfolio();
  const { points, isLoading } = useHistory(assets, transactions, ratesPerUsd, base);

  const [tf, setTf] = useState("1y");
  const [showShare, setShowShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const view = useMemo(() => {
    const sliced = sliceWindow(points, tf);
    const ret = dailyReturns(sliced);
    const first = sliced[0];
    const last = sliced[sliced.length - 1];
    const elapsedDays =
      first && last
        ? Math.max(1, (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000)
        : 1;
    const netFlow = sliced.reduce((s, p) => s + p.flow, 0);
    const absChange =
      first && last ? last.value - first.value - netFlow : null;
    const metrics = computeMetrics(
      ret.returns,
      ret.cumulative,
      elapsedDays,
      settings.riskFreeRate ?? 0.0575,
    );
    return { sliced, ret, metrics, absChange };
  }, [points, tf, settings.riskFreeRate]);

  // context-aware benchmarks (only what the user actually holds)
  const benchmarks = useMemo(() => relevantBenchmarks(assets), [assets]);
  const benchSymbols = benchmarks.map((b) => b.symbol).join(",");
  const benchQ = useQuery({
    queryKey: ["benchmarks", benchSymbols],
    queryFn: async () => {
      if (!benchSymbols) return { series: {} };
      const r = await fetch(
        `/api/history?symbols=${encodeURIComponent(benchSymbols)}&range=5y`,
      );
      if (!r.ok) throw new Error(`benchmarks ${r.status}`);
      return r.json();
    },
    enabled: benchSymbols.length > 0,
    staleTime: 3600_000,
    refetchOnWindowFocus: false,
  });
  const comparison = useMemo(
    () => buildComparison(view.sliced, benchQ.data?.series ?? {}, benchmarks),
    [view.sliced, benchQ.data, benchmarks],
  );

  const positive = view.ret.cumulative >= 0;
  const leveraged = snapshot.positions.some((p) => p.leverage > 1.0001);
  const tfLabel = TFS.find((t) => t.k === tf)?.label ?? tf.toUpperCase();
  const message = pickMessage(positive);

  async function doShare() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const url = await captureNode(cardRef.current);
      await shareOrDownload(url, `folio-${tf}.png`);
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated)
    return <div className="py-20 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="animate-fade space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Performance
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Time-weighted — your investing skill, not your deposits.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowShare(true)}>
          <Share2 size={14} /> Share
        </Button>
      </div>

      {/* timeframe pills */}
      <div className="flex gap-1.5">
        {TFS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTf(t.k)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              tf === t.k
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* headline + chart */}
      <Card className="p-5">
        <div className="mb-3 flex items-baseline gap-3">
          <span className={cn("text-3xl font-bold tabular", pnlColor(view.ret.cumulative))}>
            {formatPercent(view.ret.cumulative)}
          </span>
          <Money
            value={view.absChange}
            currency={base}
            signed
            compact
            className={cn("text-sm tabular", pnlColor(view.absChange))}
          />
        </div>
        {isLoading ? (
          <div className="grid h-[240px] place-items-center text-sm text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <PerformanceChart data={view.sliced} base={base} positive={positive} />
        )}
      </Card>

      <MetricsPanel m={view.metrics} />

      <BenchmarkChart
        data={comparison.data}
        benchmarks={benchmarks}
        summary={comparison.summary}
        portReturn={comparison.portReturn}
        loading={benchQ.isLoading}
      />

      {/* share modal */}
      {showShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !busy && setShowShare(false)}
        >
          <div
            className="animate-fade flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareCard
              ref={cardRef}
              tfLabel={tfLabel}
              twr={view.ret.cumulative}
              absChange={view.absChange}
              base={base}
              sharpe={view.metrics.sharpe}
              reliable={view.metrics.reliable}
              maxDrawdown={view.metrics.maxDrawdown}
              message={message}
              leveraged={leveraged}
              shortWindow={tf === "3d" || tf === "7d"}
              censored={censored}
            />
            <div className="flex gap-2">
              <Button onClick={doShare} disabled={busy}>
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Save / Share image
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowShare(false)}
                disabled={busy}
              >
                <X size={16} /> Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
