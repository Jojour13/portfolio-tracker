"use client";

import type { Metrics } from "@/lib/metrics";
import { sharpeLabel } from "@/lib/metrics";
import { formatPercent, pnlColor } from "@/lib/format";
import { Card } from "./ui";
import { cn } from "@/lib/utils";

function Chip({
  label,
  value,
  sub,
  color = "text-zinc-100",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="tile rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 hover:bg-zinc-800/50">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={cn("text-base font-semibold tabular", color)}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

export function MetricsPanel({ m }: { m: Metrics }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          Performance metrics
        </h2>
        <span className="text-[11px] text-zinc-500">
          deposits &amp; withdrawals excluded (TWR)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip
          label="Return (TWR)"
          value={formatPercent(m.twr)}
          color={pnlColor(m.twr)}
        />
        <Chip
          label="CAGR"
          value={formatPercent(m.cagr)}
          color={pnlColor(m.cagr)}
        />
        <Chip
          label="Sharpe"
          value={m.reliable && m.sharpe !== null ? m.sharpe.toFixed(2) : "—"}
          sub={
            m.reliable
              ? m.sharpe !== null
                ? sharpeLabel(m.sharpe)
                : undefined
              : `need ${30 - m.nObs} more days`
          }
        />
        <Chip
          label="Max drawdown"
          value={formatPercent(m.maxDrawdown)}
          color="text-rose-300"
        />
        <Chip label="Volatility" value={formatPercent(m.volAnnual)} sub="annual" />
        <Chip
          label="Sortino"
          value={m.reliable && m.sortino !== null ? m.sortino.toFixed(2) : "—"}
        />
        <Chip label="Win rate" value={formatPercent(m.winRate, 0)} sub="green days" />
        <Chip
          label="Best / worst"
          value={formatPercent(m.best, 1)}
          sub={`worst ${formatPercent(m.worst, 1)}`}
          color="text-emerald-300"
        />
      </div>
    </Card>
  );
}
