"use client";

import { useMemo, useState } from "react";
import { Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useFolio } from "@/lib/store";
import { Card, Badge, Button } from "@/components/ui";
import { Money } from "@/components/Money";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/lib/types";

const TYPE_STYLE: Record<AssetType, string> = {
  crypto: "bg-amber-500/15 text-amber-300",
  stock: "bg-sky-500/15 text-sky-300",
  cash: "bg-emerald-500/15 text-emerald-300",
};

export default function HistoryPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const deleteTransaction = useFolio((s) => s.deleteTransaction);
  const [filter, setFilter] = useState<"all" | AssetType>("all");

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  const rows = useMemo(() => {
    return [...transactions]
      .map((t) => ({ t, asset: assetMap[t.assetId] }))
      .filter((r) => r.asset && (filter === "all" || r.asset.type === filter))
      .sort((a, b) => b.t.date.localeCompare(a.t.date) || b.t.id.localeCompare(a.t.id));
  }, [transactions, assetMap, filter]);

  if (!hydrated)
    return <div className="py-20 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="animate-fade space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Trade history
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {transactions.length} transactions
          </p>
        </div>
      </div>

      {/* filter chips */}
      <div className="flex gap-1.5">
        {(["all", "crypto", "stock", "cash"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === f
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="py-16 text-center text-zinc-500">
          No transactions yet.
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-800/70">
          {rows.map(({ t, asset }) => {
            const isBuy = t.side === "buy";
            const lots = asset.lotSize > 1 ? t.quantity / asset.lotSize : null;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                    isBuy
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-rose-500/15 text-rose-400",
                  )}
                >
                  {isBuy ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {asset.symbol}
                    </span>
                    <Badge className={TYPE_STYLE[asset.type]}>
                      {asset.type}
                    </Badge>
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        isBuy ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {asset.type === "cash"
                        ? isBuy
                          ? "deposit"
                          : "withdraw"
                        : t.side}
                    </span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {t.date}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-white tabular">
                    {asset.type === "cash" ? (
                      <Money
                        value={t.quantity}
                        currency={asset.currency}
                        compact
                      />
                    ) : (
                      `${lots !== null ? formatNumber(lots, 0) + " lot" : formatNumber(t.quantity, 4)}`
                    )}
                  </div>
                  {asset.type !== "cash" && (
                    <div className="text-[11px] text-zinc-500 tabular">
                      @ {formatMoney(t.price, asset.currency)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteTransaction(t.id)}
                  className="ml-1 rounded-lg p-2 text-zinc-600 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                  title="Delete transaction"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
