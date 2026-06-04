"use client";

import Link from "next/link";
import { AlertTriangle, Check, SlidersHorizontal, ArrowRight } from "lucide-react";
import type { TargetAllocation, ValuedPosition } from "@/lib/types";
import { currentAllocation, computeDrift, maxDrift } from "@/lib/risk";
import { Card, Button } from "./ui";
import { Money } from "./Money";
import { formatPercent, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types";

const CLASS_LABEL = { crypto: "Crypto", stock: "Stocks", cash: "Cash" } as const;
const CLASS_COLOR = {
  crypto: "bg-amber-400",
  stock: "bg-sky-400",
  cash: "bg-emerald-400",
} as const;

interface Suggestion {
  kind: "trim" | "add";
  cls: keyof TargetAllocation;
  amountBase: number;
  symbol?: string;
  units?: number;
  isLots?: boolean;
}

export function AllocationVsTarget({
  positions,
  target,
  base,
  threshold = 0.07,
}: {
  positions: ValuedPosition[];
  target?: TargetAllocation;
  base: Currency;
  threshold?: number;
}) {
  if (!target) {
    return (
      <Card className="flex flex-col items-center gap-2 p-5 text-center">
        <SlidersHorizontal className="text-zinc-500" size={20} />
        <h2 className="text-sm font-medium text-zinc-200">
          Set your target allocation
        </h2>
        <p className="max-w-xs text-xs text-zinc-500">
          Take the risk quiz or design your own mix. Folio will compare it to
          your real portfolio and flag when you drift off target — it never
          changes your holdings.
        </p>
        <Link href="/settings#risk">
          <Button size="sm" variant="outline">
            Set a target
          </Button>
        </Link>
      </Card>
    );
  }

  const current = currentAllocation(positions);
  const drifts = computeDrift(current, target);
  const worst = maxDrift(drifts);
  const offTarget = worst > threshold;
  const total = positions.reduce((s, p) => s + (p.marketValueBase ?? 0), 0);

  // Build concrete (non-advisory) rebalance suggestions.
  const suggestions: Suggestion[] = [];
  if (offTarget && total > 0) {
    const over = drifts.filter((d) => d.diff > 0).sort((a, b) => b.diff - a.diff);
    const under = drifts.filter((d) => d.diff < 0).sort((a, b) => a.diff - b.diff);

    for (const o of over) {
      const amountBase = o.diff * total;
      const holdings = positions
        .filter((p) => p.asset.type === o.cls && (p.marketValueBase ?? 0) > 0)
        .sort((a, b) => (b.marketValueBase ?? 0) - (a.marketValueBase ?? 0));
      const top = holdings[0];
      let units: number | undefined;
      let isLots = false;
      if (top && top.quantity > 0 && (top.marketValueBase ?? 0) > 0) {
        const unitVal = top.marketValueBase! / top.quantity;
        const sellBase = Math.min(amountBase, top.marketValueBase!);
        units = sellBase / unitVal;
        if (top.asset.lotSize > 1) {
          units = units / top.asset.lotSize;
          isLots = true;
        }
      }
      suggestions.push({
        kind: "trim",
        cls: o.cls,
        amountBase,
        symbol: top?.asset.symbol,
        units,
        isLots,
      });
    }
    for (const u of under) {
      suggestions.push({ kind: "add", cls: u.cls, amountBase: -u.diff * total });
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          Allocation vs target
        </h2>
        <Link
          href="/settings#risk"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Adjust
        </Link>
      </div>

      <div className="space-y-3">
        {drifts.map((d) => (
          <div key={d.cls}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-zinc-300">{CLASS_LABEL[d.cls]}</span>
              <span className="tabular text-zinc-500">
                <span className="text-zinc-300">{formatPercent(d.current, 0)}</span>
                {" / "}
                target {formatPercent(d.target, 0)}
                <span
                  className={cn(
                    "ml-1.5",
                    Math.abs(d.diff) > threshold
                      ? d.diff > 0
                        ? "text-amber-400"
                        : "text-sky-400"
                      : "text-zinc-600",
                  )}
                >
                  ({d.diff > 0 ? "+" : ""}
                  {formatPercent(d.diff, 0)})
                </span>
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn("h-full rounded-full transition-all", CLASS_COLOR[d.cls])}
                style={{ width: `${Math.min(100, d.current * 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-white/80"
                style={{ left: `${Math.min(100, d.target * 100)}%` }}
                title="target"
              />
            </div>
          </div>
        ))}
      </div>

      {!offTarget ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
          <Check size={14} className="shrink-0" />
          On target — within {formatPercent(threshold, 0)} of your plan.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-300">
            <AlertTriangle size={14} /> Off balance — consider rebalancing:
          </div>
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300"
              >
                <ArrowRight
                  size={13}
                  className={cn(
                    "mt-0.5 shrink-0",
                    s.kind === "trim" ? "text-amber-400" : "text-sky-400",
                  )}
                />
                <span>
                  {s.kind === "trim" ? "Trim" : "Add to"}{" "}
                  <b className="text-zinc-100">{CLASS_LABEL[s.cls]}</b> by ~
                  <Money value={s.amountBase} currency={base} compact />
                  {s.kind === "trim" && s.symbol && s.units && s.units > 0 && (
                    <>
                      {" "}— e.g. sell ~{formatNumber(s.units, s.isLots ? 0 : 4)}{" "}
                      {s.isLots ? "lot" : "unit"}
                      {s.units >= 2 ? "s" : ""} of{" "}
                      <b className="text-zinc-100">{s.symbol}</b>
                    </>
                  )}
                  {s.kind === "add" && " with the proceeds"}.
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Illustrative only, based on your target mix — <b>not financial
            advice</b>. You decide what to trade; Folio never moves anything for
            you.
          </p>
        </div>
      )}
    </Card>
  );
}
