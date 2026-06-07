"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Check, Wand2 } from "lucide-react";
import type { Asset, Currency, SearchableAssetType, TargetAllocation } from "@/lib/types";
import {
  ASSET_TYPE_LABEL,
  CURRENCIES,
  TARGET_CLASSES,
  TARGET_CLASS_LABEL,
  TRADEABLE_ASSET_TYPES,
  targetClassForAssetType,
} from "@/lib/types";
import type { SearchResult } from "@/app/api/search/route";
import { useFolio } from "@/lib/store";
import { usePrices } from "@/hooks/usePrices";
import { convertOrNull } from "@/lib/portfolio";
import { TickerSearch } from "./TickerSearch";
import { Money } from "./Money";
import { Card, Button, Input, Select, Label } from "./ui";
import { formatNumber, formatPercent, formatMoney } from "@/lib/format";
import { cn, colorForIndex } from "@/lib/utils";

const TYPE_TABS = [...TRADEABLE_ASSET_TYPES, "cash"] as const;
type Tab = (typeof TYPE_TABS)[number];

export function ModelBuilder() {
  const model = useFolio((s) => s.modelPortfolio);
  const addModelHolding = useFolio((s) => s.addModelHolding);
  const updateModelQty = useFolio((s) => s.updateModelQty);
  const removeModelHolding = useFolio((s) => s.removeModelHolding);
  const clearModel = useFolio((s) => s.clearModel);
  const base = useFolio((s) => s.settings.baseCurrency);
  const rebalanceThreshold = useFolio((s) => s.settings.rebalanceThreshold);
  const updateSettings = useFolio((s) => s.updateSettings);

  // reuse the live price hooks (ModelHolding is structurally an Asset)
  const { quotes, ratesPerUsd } = usePrices(model as unknown as Asset[], 60);

  const valued = useMemo(
    () =>
      model.map((h) => {
        const price = h.type === "cash" ? 1 : quotes[h.quoteId]?.price ?? null;
        const valueBase =
          price !== null
            ? convertOrNull(h.qty * price, h.currency, base, ratesPerUsd)
            : null;
        return { ...h, price, valueBase };
      }),
    [model, quotes, ratesPerUsd, base],
  );

  const total = valued.reduce((s, v) => s + (v.valueBase ?? 0), 0);
  const unconvertedCount = valued.filter(
    (v) => v.price !== null && v.valueBase === null,
  ).length;

  const classMix = useMemo(() => {
    const t: TargetAllocation = {
      crypto: 0,
      stock: 0,
      fixedIncome: 0,
      cash: 0,
    };
    for (const v of valued) {
      t[targetClassForAssetType(v.type)] += v.valueBase ?? 0;
    }
    return t;
  }, [valued]);

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  function saveAsTarget() {
    if (total <= 0 || unconvertedCount > 0) return;
    setSaveError(null);
    const result = updateSettings({
      riskProfile: "custom",
      targetAllocation: {
        crypto: classMix.crypto / total,
        stock: classMix.stock / total,
        fixedIncome: classMix.fixedIncome / total,
        cash: classMix.cash / total,
      },
      rebalanceThreshold: rebalanceThreshold ?? 0.07,
    });
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const pieData = valued.map((v, i) => ({
    name: v.symbol,
    value: v.valueBase ?? 0,
    color: colorForIndex(i),
  }));

  return (
    <div className="space-y-5">
      <AddRow onAdd={addModelHolding} />

      {model.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <Wand2 className="text-zinc-500" size={22} />
          <p className="text-sm font-medium text-zinc-200">
            Build your ideal portfolio
          </p>
          <p className="max-w-sm text-xs text-zinc-500">
            Add the holdings you'd <i>like</i> to own — e.g. 20 shares of Apple,
            0.5 BTC, 5,000 SGD cash — and watch the allocation pie form. Save it
            as your target to compare against your real portfolio.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {unconvertedCount > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              {unconvertedCount} model holding
              {unconvertedCount === 1 ? "" : "s"} cannot be converted to{" "}
              {base}. Target saving is paused until FX data is available.
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* pie */}
          <Card className="p-5">
            <div className="relative h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  Model value
                </span>
                <Money
                  value={total}
                  currency={base}
                  compact
                  className="text-xl font-semibold text-white tabular"
                />
              </div>
            </div>
            {/* class mix */}
            <div className="mt-3 space-y-1 text-xs">
              {TARGET_CLASSES.map((k) => (
                <div key={k} className="flex justify-between text-zinc-400">
                  <span>{TARGET_CLASS_LABEL[k]}</span>
                  <span className="tabular">
                    {total > 0 ? formatPercent(classMix[k] / total, 0) : "—"}
                  </span>
                </div>
              ))}
            </div>
            {saveError && (
              <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {saveError}
              </p>
            )}
            <Button
              className="mt-4 w-full"
              onClick={saveAsTarget}
              disabled={total <= 0 || unconvertedCount > 0}
            >
              {saved ? (
                <>
                  <Check size={16} /> Saved as target
                </>
              ) : (
                "Use as my target allocation"
              )}
            </Button>
          </Card>

          {/* holdings list */}
          <Card className="divide-y divide-zinc-800/70">
            {valued.map((v, i) => {
              const lots = v.lotSize > 1;
              const display = lots ? v.qty / v.lotSize : v.qty;
              const weight = total > 0 ? (v.valueBase ?? 0) / total : 0;
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-7 w-1.5 shrink-0 rounded-full"
                    style={{ background: colorForIndex(i) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{v.symbol}</span>
                      <span className="text-[11px] text-zinc-500">
                        {formatPercent(weight, 0)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {v.type === "cash"
                        ? v.name
                        : `${formatMoney(v.price, v.currency)} · ${v.currency}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={display}
                      onChange={(e) =>
                        updateModelQty(
                          v.id,
                          (parseFloat(e.target.value) || 0) *
                            (lots ? v.lotSize : 1),
                        )
                      }
                      className="h-8 w-20 text-right text-xs"
                    />
                    <span className="w-8 text-[10px] text-zinc-500">
                      {v.type === "cash" ? v.currency : lots ? "lots" : "qty"}
                    </span>
                  </div>

                  <Money
                    value={v.valueBase}
                    currency={base}
                    compact
                    className="w-20 shrink-0 text-right text-sm font-medium text-white tabular"
                  />

                  <button
                    type="button"
                    onClick={() => removeModelHolding(v.id)}
                    className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <div className="px-4 py-2.5 text-right">
              <button
                type="button"
                onClick={clearModel}
                className="text-xs text-zinc-500 hover:text-rose-400"
              >
                Clear all
              </button>
            </div>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}

function AddRow({
  onAdd,
}: {
  onAdd: (h: Omit<import("@/lib/types").ModelHolding, "id">) => void;
}) {
  const [tab, setTab] = useState<Tab>("crypto");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [cashCcy, setCashCcy] = useState<Currency>("SGD");
  const [qtyInput, setQty] = useState("");

  const isCash = tab === "cash";
  const usesLots = !isCash && (picked?.lotSize ?? 1) > 1;
  const qtyNum = parseFloat(qtyInput) || 0;
  const canAdd = isCash ? qtyNum > 0 : picked && qtyNum > 0;

  function reset(t: Tab) {
    setTab(t);
    setPicked(null);
    setQty("");
  }

  function add() {
    if (isCash) {
      onAdd({
        type: "cash",
        symbol: cashCcy,
        name: `Cash (${cashCcy})`,
        currency: cashCcy,
        quoteSource: "cash",
        quoteId: `cash-${cashCcy.toLowerCase()}`,
        lotSize: 1,
        qty: qtyNum,
      });
    } else if (picked) {
      const lotSize = picked.lotSize;
      onAdd({
        type: picked.type,
        symbol: picked.symbol,
        name: picked.name,
        currency: picked.currency,
        quoteSource: picked.quoteSource,
        quoteId: picked.quoteId,
        lotSize,
        qty: usesLots ? qtyNum * lotSize : qtyNum,
      });
    }
    setPicked(null);
    setQty("");
  }

  return (
    <Card className="relative z-30 overflow-visible p-4">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900/60 p-1 sm:grid-cols-3">
        {TYPE_TABS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => reset(t)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {ASSET_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          {isCash ? (
            <>
              <Label>Currency</Label>
              <Select
                value={cashCcy}
                onChange={(e) => setCashCcy(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Label>
                {tab === "crypto"
                  ? "Coin"
                  : tab === "fund"
                    ? "Fund / ETF"
                    : tab === "bond"
                      ? "Bond fund"
                      : tab === "money_market"
                        ? "Money market fund"
                        : "Ticker"}
              </Label>
              <TickerSearch
                key={tab}
                type={tab as SearchableAssetType}
                onSelect={setPicked}
                onQueryChange={() => setPicked(null)}
              />
            </>
          )}
        </div>
        <div className="w-full sm:w-32">
          <Label>{isCash ? "Amount" : usesLots ? "Lots" : "Quantity"}</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={qtyInput}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <Button onClick={add} disabled={!canAdd} className="sm:w-auto">
          <Plus size={16} /> Add
        </Button>
      </div>
    </Card>
  );
}
