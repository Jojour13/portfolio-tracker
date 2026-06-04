"use client";

import { TrendingUp, Wallet, Activity, PiggyBank } from "lucide-react";
import type { Currency, PortfolioSnapshot } from "@/lib/types";
import { Card } from "./ui";
import { Money } from "./Money";
import { formatPercent, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SummaryCards({
  snapshot,
  base,
}: {
  snapshot: PortfolioSnapshot;
  base: Currency;
}) {
  const items = [
    {
      label: "Total Value",
      icon: Wallet,
      value: <Money value={snapshot.totalValueBase} currency={base} />,
      sub: (
        <>
          Invested{" "}
          <Money value={snapshot.totalInvestedBase} currency={base} compact />
        </>
      ),
      color: "text-white",
    },
    {
      label: "1D P/L",
      icon: Activity,
      value: <Money value={snapshot.dayChangeBase} currency={base} signed />,
      sub: formatPercent(snapshot.dayChangePct),
      color: pnlColor(snapshot.dayChangeBase),
    },
    {
      label: "Unrealized P/L",
      icon: TrendingUp,
      value: (
        <Money value={snapshot.totalUnrealizedPnlBase} currency={base} signed />
      ),
      sub: formatPercent(snapshot.totalUnrealizedPnlPct),
      color: pnlColor(snapshot.totalUnrealizedPnlBase),
    },
    {
      label: "Realized P/L",
      icon: PiggyBank,
      value: (
        <Money value={snapshot.totalRealizedBase} currency={base} signed />
      ),
      sub: "Booked from sells",
      color: pnlColor(snapshot.totalRealizedBase),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {it.label}
            </span>
            <it.icon size={16} className="text-zinc-600" />
          </div>
          <div className={cn("text-xl font-semibold tabular", it.color)}>
            {it.value}
          </div>
          <div className={cn("mt-0.5 text-xs tabular", it.color)}>{it.sub}</div>
        </Card>
      ))}
    </div>
  );
}
