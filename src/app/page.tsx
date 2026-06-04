"use client";

import Link from "next/link";
import { RefreshCw, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useFolio } from "@/lib/store";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationDonut } from "@/components/AllocationDonut";
import { HoldingsTable } from "@/components/HoldingsTable";
import { Card, Button } from "@/components/ui";
import { cn, colorForIndex } from "@/lib/utils";

export default function DashboardPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const { snapshot, base, isFetching, lastUpdated, refetch, hasData } =
    usePortfolio();

  const [ago, setAgo] = useState("");
  useEffect(() => {
    const tick = () => {
      if (!lastUpdated) return setAgo("");
      const s = Math.round((Date.now() - lastUpdated) / 1000);
      setAgo(s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  if (!hydrated) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="animate-fade space-y-5">
      {/* header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Portfolio
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                isFetching ? "animate-pulse bg-amber-400" : "bg-emerald-400",
              )}
            />
            {isFetching ? "Updating…" : `Live · updated ${ago || "—"}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/add">
            <Button size="sm">
              <PlusCircle size={14} /> Add
            </Button>
          </Link>
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <SummaryCards snapshot={snapshot} base={base} />

          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <Card className="p-5">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">
                Allocation
              </h2>
              <AllocationDonut snapshot={snapshot} base={base} />
              <div className="mt-3 space-y-1.5">
                {snapshot.positions.slice(0, 6).map((p, i) => (
                  <Legend
                    key={p.asset.id}
                    i={i}
                    label={p.asset.symbol}
                    weight={p.weight}
                  />
                ))}
              </div>
            </Card>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Holdings</h2>
              <HoldingsTable positions={snapshot.positions} base={base} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({
  i,
  label,
  weight,
}: {
  i: number;
  label: string;
  weight: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: colorForIndex(i) }}
      />
      <span className="text-zinc-300">{label}</span>
      <span className="ml-auto text-zinc-500 tabular">
        {(weight * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/60" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-zinc-800/40"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-800/40" />
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-800/40" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-2xl font-bold text-white">
        ƒ
      </span>
      <h2 className="text-lg font-semibold text-white">No holdings yet</h2>
      <p className="max-w-sm text-sm text-zinc-400">
        Add your first trade — a crypto buy, a stock position, or a cash
        balance — and watch your allocation come to life in real time.
      </p>
      <Link href="/add">
        <Button>
          <PlusCircle size={16} /> Add a transaction
        </Button>
      </Link>
    </Card>
  );
}
