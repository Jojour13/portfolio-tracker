"use client";

import { useState } from "react";
import { ArrowRight, Check, Repeat } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/types";
import { useFolio } from "@/lib/store";
import { usePrices } from "@/hooks/usePrices";
import { convert } from "@/lib/portfolio";
import { Card, Button, Input, Select, Label } from "./ui";
import { formatMoney } from "@/lib/format";

export function CashConverter() {
  const upsertAsset = useFolio((s) => s.upsertAsset);
  const addTransaction = useFolio((s) => s.addTransaction);
  const { ratesPerUsd } = usePrices([], 0); // fx-only

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<Currency>("SGD");
  const [to, setTo] = useState<Currency>("IDR");
  const [spread, setSpread] = useState(0.5); // % the money-changer / broker takes
  const [recorded, setRecorded] = useState(false);

  const amt = parseFloat(amount) || 0;
  const mid = convert(amt, from, to, ratesPerUsd);
  const effective = mid * (1 - spread / 100);
  const midRate = convert(1, from, to, ratesPerUsd);
  const effRate = midRate * (1 - spread / 100);
  const cost = mid - effective;

  function recordSwitch() {
    if (amt <= 0 || from === to) return;
    const fromId = upsertAsset({
      type: "cash",
      symbol: from,
      name: `Cash (${from})`,
      currency: from,
      quoteSource: "cash",
      quoteId: `cash-${from.toLowerCase()}`,
      lotSize: 1,
    });
    addTransaction(fromId, {
      side: "sell",
      quantity: amt,
      price: 1,
      fee: 0,
      note: `FX → ${to}`,
    });
    const toId = upsertAsset({
      type: "cash",
      symbol: to,
      name: `Cash (${to})`,
      currency: to,
      quoteSource: "cash",
      quoteId: `cash-${to.toLowerCase()}`,
      lotSize: 1,
    });
    addTransaction(toId, {
      side: "buy",
      quantity: effective,
      price: 1,
      fee: 0,
      note: `FX ← ${from} (${spread}% spread)`,
    });
    setRecorded(true);
    setTimeout(() => setRecorded(false), 2200);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
        <Repeat size={15} /> Currency converter
      </h2>
      <p className="mb-4 mt-1 text-xs text-zinc-500">
        Convert cash at the live rate, minus a spread you control. Record it and
        your cash balances update across both currencies.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Amount</Label>
          <Input
            type="number"
            inputMode="decimal"
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
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-1 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="Swap"
        >
          <ArrowRight size={16} />
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
            {amt > 0 ? formatMoney(effective, to) : "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>
            1 {from} = {effRate.toFixed(to === "IDR" ? 0 : 4)} {to}
          </span>
          {amt > 0 && (
            <span>spread cost ≈ {formatMoney(cost, to, { compact: true })}</span>
          )}
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        onClick={recordSwitch}
        disabled={amt <= 0 || from === to}
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
