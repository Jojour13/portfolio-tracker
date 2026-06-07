"use client";

import {
  ASSET_TYPE_LABEL,
  type AssetType,
  type Currency,
  type ValuedPosition,
} from "@/lib/types";
import { Card, Badge } from "./ui";
import { Money } from "./Money";
import {
  formatMoney,
  formatNumber,
  formatPercent,
  pnlColor,
} from "@/lib/format";
import { cn, colorForIndex } from "@/lib/utils";

const TYPE_STYLE: Record<AssetType, string> = {
  crypto: "bg-amber-500/15 text-amber-300",
  stock: "bg-sky-500/15 text-sky-300",
  fund: "bg-cyan-500/15 text-cyan-300",
  bond: "bg-violet-500/15 text-violet-300",
  money_market: "bg-teal-500/15 text-teal-300",
  cash: "bg-emerald-500/15 text-emerald-300",
};

function qtyLabel(p: ValuedPosition): string {
  if (p.asset.type === "cash") return "—";
  if (p.asset.lotSize > 1) {
    return `${formatNumber(p.quantity / p.asset.lotSize, 0)} lots`;
  }
  return formatNumber(p.quantity, 4);
}

export function HoldingsTable({
  positions,
  base,
}: {
  positions: ValuedPosition[];
  base: Currency;
}) {
  return (
    <Card className="overflow-hidden">
      {/* header (desktop) */}
      <div className="hidden grid-cols-12 gap-3 border-b border-zinc-800 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500 md:grid">
        <div className="col-span-3">Asset</div>
        <div className="col-span-2 text-right">Holdings</div>
        <div className="col-span-2 text-right">Avg / Price</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-1 text-right">Today</div>
        <div className="col-span-2 text-right">P/L</div>
      </div>

      <div className="divide-y divide-zinc-800/70">
        {positions.map((p, i) => (
          <div
            key={p.asset.id}
            className="grid grid-cols-2 gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-800/30 md:grid-cols-12 md:items-center"
          >
            {/* asset */}
            <div className="col-span-2 flex items-center gap-3 md:col-span-3">
              <span
                className="h-7 w-1.5 shrink-0 rounded-full"
                style={{ background: colorForIndex(i) }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {p.asset.symbol}
                  </span>
                  <Badge className={TYPE_STYLE[p.asset.type]}>
                    {ASSET_TYPE_LABEL[p.asset.type]}
                  </Badge>
                  {p.leverage > 1.0001 && (
                    <Badge className="bg-amber-500/15 text-amber-300">
                      {p.leverage.toFixed(p.leverage % 1 ? 1 : 0)}x
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {p.asset.name} · {formatPercent(p.weight, 1)}
                </div>
              </div>
            </div>

            {/* holdings */}
            <div className="text-right md:col-span-2">
              <div className="text-sm text-zinc-200 tabular">{qtyLabel(p)}</div>
              <div className="text-[11px] text-zinc-500 md:hidden">Holdings</div>
            </div>

            {/* avg / price */}
            <div className="hidden text-right md:col-span-2 md:block">
              <div className="text-sm text-zinc-200 tabular">
                {p.asset.type === "cash"
                  ? "—"
                  : formatMoney(p.price, p.asset.currency)}
              </div>
              <div className="text-[11px] text-zinc-500 tabular">
                avg {formatMoney(p.avgCost, p.asset.currency)}
              </div>
              {p.distanceToLiqPct !== null && (
                <div className="text-[11px] text-amber-400/80 tabular">
                  liq {formatPercent(-p.distanceToLiqPct, 0)}
                </div>
              )}
            </div>

            {/* value */}
            <div className="text-right md:col-span-2">
              <Money
                value={p.marketValueBase}
                currency={base}
                compact
                className="text-sm font-medium text-white tabular"
              />
              {p.asset.type !== "cash" && p.price === null ? (
                <div className="text-[11px] text-amber-400">No quote</div>
              ) : p.marketValueBase === null ? (
                <div className="text-[11px] text-amber-400">No FX rate</div>
              ) : null}
              {p.borrowed > 0 && (
                <div className="text-[11px] text-amber-400/80 tabular">
                  debt {formatMoney(p.borrowed, p.asset.currency, { compact: true })}
                </div>
              )}
              <div className="text-[11px] text-zinc-500 md:hidden">Value</div>
            </div>

            <div className="text-right md:hidden">
              <div className="text-sm text-zinc-200 tabular">
                {p.asset.type === "cash"
                  ? "-"
                  : formatMoney(p.price, p.asset.currency)}
              </div>
              <div className="text-[11px] text-zinc-500 tabular">
                avg {formatMoney(p.avgCost, p.asset.currency)}
              </div>
            </div>

            {/* today */}
            <div className="hidden text-right md:col-span-1 md:block">
              <span className={cn("text-xs tabular", pnlColor(p.dayChangePct))}>
                {formatPercent(p.dayChangePct)}
              </span>
            </div>

            {/* p/l */}
            <div className="col-span-2 text-right md:col-span-2">
              <div className={cn("mb-0.5 text-[11px] tabular md:hidden", pnlColor(p.dayChangePct))}>
                Today {formatPercent(p.dayChangePct)}
              </div>
              <div
                className={cn(
                  "text-sm font-medium tabular",
                  pnlColor(p.unrealizedPnlPct),
                )}
              >
                {formatPercent(p.unrealizedPnlPct)}
              </div>
              <Money
                value={p.unrealizedPnlNative}
                currency={p.asset.currency}
                signed
                compact
                className={cn(
                  "text-[11px] tabular",
                  pnlColor(p.unrealizedPnlNative),
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
