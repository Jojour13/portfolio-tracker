"use client";

import { useMemo, useState } from "react";
import type { SeriesPoint } from "@/lib/history";
import type { Currency } from "@/lib/types";
import { periodPnl, type Grouping } from "@/lib/pnlPeriods";
import { Card } from "./ui";
import { Money } from "./Money";
import { cn } from "@/lib/utils";

const TABS: { k: Grouping; label: string; take: number }[] = [
  { k: "day", label: "Daily", take: 14 },
  { k: "week", label: "Weekly", take: 10 },
  { k: "month", label: "Monthly", take: 12 },
];

export function PnlPeriods({
  points,
  base,
  loading,
}: {
  points: SeriesPoint[];
  base: Currency;
  loading?: boolean;
}) {
  const [by, setBy] = useState<Grouping>("day");
  const take = TABS.find((t) => t.k === by)!.take;

  const rows = useMemo(() => {
    const all = periodPnl(points, by);
    return all.slice(-take).reverse();
  }, [points, by, take]);

  const maxAbs = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(r.pnl))),
    [rows],
  );

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">Profit &amp; loss</h2>
        <div className="flex gap-1 rounded-lg bg-zinc-900/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setBy(t.k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                by === t.k
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Not enough history yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const up = r.pnl >= 0;
            const w = (Math.abs(r.pnl) / maxAbs) * 100;
            return (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-zinc-500">
                  {r.label}
                </span>
                {/* diverging bar */}
                <div className="flex flex-1 items-center">
                  <div className="flex w-1/2 justify-end">
                    {!up && (
                      <div
                        className="h-2 rounded-l-full bg-rose-500/70"
                        style={{ width: `${w}%` }}
                      />
                    )}
                  </div>
                  <div className="h-3 w-px bg-zinc-700" />
                  <div className="flex w-1/2 justify-start">
                    {up && (
                      <div
                        className="h-2 rounded-r-full bg-emerald-500/70"
                        style={{ width: `${w}%` }}
                      />
                    )}
                  </div>
                </div>
                <Money
                  value={r.pnl}
                  currency={base}
                  signed
                  compact
                  className={cn(
                    "w-24 shrink-0 text-right text-xs font-medium tabular",
                    up ? "text-emerald-400" : "text-rose-400",
                  )}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
