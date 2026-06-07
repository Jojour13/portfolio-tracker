"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Repeat } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/types";
import { useFolio } from "@/lib/store";
import { usePrices } from "@/hooks/usePrices";
import { convertOrNull } from "@/lib/portfolio";
import { Card, Button, Input, Select, Label } from "./ui";
import { formatMoney } from "@/lib/format";
import { localIsoDate, uid } from "@/lib/utils";

const EPSILON = 1e-9;

function netQuantity(
  transactions: { assetId: string; side: "buy" | "sell"; quantity: number; date: string }[],
  assetId: string,
  throughDate?: string,
) {
  return transactions
    .filter((t) => t.assetId === assetId && (!throughDate || t.date <= throughDate))
    .reduce((q, t) => q + (t.side === "buy" ? t.quantity : -t.quantity), 0);
}

export function CashConverter() {
  const addAssetTransactions = useFolio((s) => s.addAssetTransactions);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const { ratesPerUsd } = usePrices([], 0); // fx-only

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<Currency>("SGD");
  const [to, setTo] = useState<Currency>("IDR");
  const [spread, setSpread] = useState(0.5); // % the money-changer / broker takes
  const [recorded, setRecorded] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  const today = localIsoDate();
  const mid = convertOrNull(amt, from, to, ratesPerUsd);
  const midRate = convertOrNull(1, from, to, ratesPerUsd);
  const fxUnavailable = from !== to && (mid === null || midRate === null);
  const midValue = mid ?? 0;
  const effective = midValue * (1 - spread / 100);
  const effRate = (midRate ?? 0) * (1 - spread / 100);
  const cost = midValue - effective;
  const fromAsset = useMemo(
    () =>
      assets.find(
        (a) => a.type === "cash" && a.quoteId === `cash-${from.toLowerCase()}`,
      ),
    [assets, from],
  );
  const fromHeld = useMemo(
    () =>
      fromAsset ? netQuantity(transactions, fromAsset.id) : 0,
    [fromAsset, transactions],
  );
  const fromAvailable = useMemo(
    () =>
      fromAsset ? netQuantity(transactions, fromAsset.id, today) : 0,
    [fromAsset, transactions, today],
  );
  const overdrawn = amt > fromAvailable + EPSILON;
  const canRecord = amt > 0 && from !== to && !overdrawn && !fxUnavailable;

  function recordSwitch() {
    setRecordError(null);
    if (!canRecord) return;
    const transferId = "fx-" + uid();
    const result = addAssetTransactions([
      {
        asset: {
          type: "cash",
          symbol: from,
          name: `Cash (${from})`,
          currency: from,
          quoteSource: "cash",
          quoteId: `cash-${from.toLowerCase()}`,
          lotSize: 1,
        },
        txn: {
          side: "sell",
          quantity: amt,
          price: 1,
          fee: 0,
          date: today,
          settlementId: transferId,
          cashFlowType: "transfer",
          note: `FX -> ${to}`,
        },
      },
      {
        asset: {
          type: "cash",
          symbol: to,
          name: `Cash (${to})`,
          currency: to,
          quoteSource: "cash",
          quoteId: `cash-${to.toLowerCase()}`,
          lotSize: 1,
        },
        txn: {
          side: "buy",
          quantity: effective,
          price: 1,
          fee: 0,
          date: today,
          settlementId: transferId,
          cashFlowType: "transfer",
          note: `FX <- ${from} (${spread}% spread)`,
        },
      },
    ]);
    if (!result.ok) {
      setRecordError(result.error);
      return;
    }
    setRecorded(true);
    setTimeout(() => setRecorded(false), 2200);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
        <Repeat size={15} /> Currency converter
      </h2>
      <p className="mb-4 mt-1 text-xs text-zinc-500">
        Record a real cash conversion at the indicative FX rate, minus a spread
        you control. This adds one linked withdrawal/deposit pair to your history.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Amount</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="w-24">
          <Label>From</Label>
          <Select value={from} onChange={(e) => setFrom(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-1 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="Swap"
        >
          <ArrowLeftRight size={16} />
        </button>
        <div className="w-24">
          <Label>To</Label>
          <Select value={to} onChange={(e) => setTo(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Available {from} today:{" "}
        {formatMoney(fromAvailable, from, { compact: true })}
      </p>
      {Math.abs(fromAvailable - fromHeld) > EPSILON && (
        <p className="mt-1 text-[11px] text-zinc-500">
          Current {from}: {formatMoney(fromHeld, from, { compact: true })}
        </p>
      )}
      {overdrawn && (
        <p className="mt-1 text-[11px] text-rose-400">
          This conversion is larger than your recorded {from} cash available
          today.
        </p>
      )}
      {fxUnavailable && (
        <p className="mt-1 text-[11px] text-rose-400">
          FX rate unavailable for {from} to {to}. Recording is paused until a
          valid rate is available.
        </p>
      )}
      {recordError && (
        <p className="mt-1 text-[11px] text-rose-400">{recordError}</p>
      )}

      {/* spread slider */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <Label className="mb-0">Spread / FX margin</Label>
          <span className="font-medium tabular text-amber-400">
            {spread.toFixed(2)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.05}
          value={spread}
          onChange={(e) => setSpread(+e.target.value)}
          className="w-full accent-amber-500"
        />
      </div>

      {/* result */}
      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">You receive</span>
          <span className="text-xl font-semibold text-white tabular">
            {amt > 0 && !fxUnavailable ? formatMoney(effective, to) : "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          {fxUnavailable ? (
            <span>Missing FX rate for this pair.</span>
          ) : (
            <>
              <span>
                1 {from} = {effRate.toFixed(to === "IDR" ? 0 : 4)} {to}
              </span>
              {amt > 0 && (
                <span>
                  spread cost ≈ {formatMoney(cost, to, { compact: true })}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        onClick={recordSwitch}
        disabled={!canRecord}
      >
        {recorded ? (
          <>
            <Check size={16} /> Recorded in your cash
          </>
        ) : (
          "Record this conversion"
        )}
      </Button>
    </Card>
  );
}
