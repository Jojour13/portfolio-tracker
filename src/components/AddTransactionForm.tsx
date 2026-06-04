"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";
import type { AssetType, Currency, TxnSide } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { useFolio } from "@/lib/store";
import { TickerSearch } from "./TickerSearch";
import { Button, Card, Input, Label, Select } from "./ui";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

type Tab = AssetType;

export function AddTransactionForm() {
  const router = useRouter();
  const upsertAsset = useFolio((s) => s.upsertAsset);
  const addTransaction = useFolio((s) => s.addTransaction);

  const [tab, setTab] = useState<Tab>("crypto");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [cashCcy, setCashCcy] = useState<Currency>("IDR");
  const [side, setSide] = useState<TxnSide>("buy");
  const [qtyInput, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [margin, setMargin] = useState(false);
  const [leverage, setLeverage] = useState("2");
  const [done, setDone] = useState(false);

  const levNum = Math.max(1, parseFloat(leverage) || 1);

  const isCash = tab === "cash";
  const lotSize = picked?.lotSize ?? 1;
  const usesLots = tab === "stock" && lotSize > 1;
  const ccy: Currency = isCash ? cashCcy : (picked?.currency ?? "USD");

  const qtyNum = parseFloat(qtyInput) || 0;
  const realQty = usesLots ? qtyNum * lotSize : qtyNum;
  const priceNum = isCash ? 1 : parseFloat(price) || 0;
  const total = realQty * priceNum + (parseFloat(fee) || 0);

  const canSubmit = isCash
    ? qtyNum > 0
    : picked && qtyNum > 0 && priceNum > 0;

  function resetPickerFor(t: Tab) {
    setTab(t);
    setPicked(null);
    setQty("");
    setPrice("");
  }

  function submit() {
    let assetId: string;
    if (isCash) {
      assetId = upsertAsset({
        type: "cash",
        symbol: cashCcy,
        name: `Cash (${cashCcy})`,
        currency: cashCcy,
        quoteSource: "cash",
        quoteId: `cash-${cashCcy.toLowerCase()}`,
        lotSize: 1,
      });
    } else if (picked) {
      assetId = upsertAsset({
        type: picked.type,
        symbol: picked.symbol,
        name: picked.name,
        currency: picked.currency,
        quoteSource: picked.quoteSource,
        quoteId: picked.quoteId,
        lotSize: picked.lotSize,
      });
    } else {
      return;
    }

    addTransaction(assetId, {
      side,
      quantity: realQty,
      price: priceNum,
      fee: parseFloat(fee) || 0,
      date,
      note: note || undefined,
      margin: !isCash && margin ? true : undefined,
      leverage: !isCash && margin ? levNum : undefined,
    });

    setDone(true);
    setTimeout(() => router.push("/"), 650);
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check size={28} />
        </span>
        <p className="text-lg font-semibold text-white">Transaction added</p>
        <p className="text-sm text-zinc-400">Updating your portfolio…</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      {/* asset type tabs */}
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-zinc-900/60 p-1">
        {(["crypto", "stock", "cash"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => resetPickerFor(t)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "bg-zinc-700 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* asset picker */}
      {isCash ? (
        <div className="mb-4">
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
        </div>
      ) : (
        <div className="mb-4">
          <Label>{tab === "crypto" ? "Coin" : "Ticker"}</Label>
          <TickerSearch
            type={tab as "crypto" | "stock"}
            onSelect={setPicked}
          />
          {picked && (
            <p className="mt-1.5 text-xs text-zinc-500">
              {picked.name} · trades in {picked.currency}
              {usesLots && ` · 1 lot = ${lotSize} shares`}
            </p>
          )}
        </div>
      )}

      {/* side toggle */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900/60 p-1">
        {(["buy", "sell"] as TxnSide[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium capitalize transition-colors",
              side === s
                ? s === "buy"
                  ? "bg-emerald-500/90 text-white"
                  : "bg-rose-500/90 text-white"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {isCash ? (s === "buy" ? "Deposit" : "Withdraw") : s}
          </button>
        ))}
      </div>

      {/* numeric inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>
            {isCash ? `Amount (${ccy})` : usesLots ? "Lots" : "Quantity"}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={usesLots ? "10" : "0.00"}
            value={qtyInput}
            onChange={(e) => setQty(e.target.value)}
          />
          {usesLots && qtyNum > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500">
              = {realQty.toLocaleString()} shares
            </p>
          )}
        </div>

        {!isCash && (
          <div>
            <Label>Price / unit ({ccy})</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label>Fee ({ccy})</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>

        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!isCash && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={margin}
              onChange={(e) => setMargin(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-amber-500"
            />
            <span className="text-sm font-medium text-zinc-200">
              Use margin / leverage
            </span>
          </label>

          {margin && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <Label className="mb-0">Leverage</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.5}
                  className="h-9 w-24"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                />
                <span className="text-sm font-semibold text-amber-400">
                  {levNum}x
                </span>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-400/90">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Leverage multiplies losses as much as gains. A {levNum}x position
                is liquidated by a ~{(100 / levNum).toFixed(0)}% move against you.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <Label>Note (optional)</Label>
        <Input
          placeholder="e.g. DCA, take profit…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* summary + submit */}
      <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          {isCash ? "Amount" : "Total cost"}
        </span>
        <span className="text-lg font-semibold text-white tabular">
          {formatMoney(total, ccy)}
        </span>
      </div>

      <Button
        className="mt-4 w-full"
        disabled={!canSubmit}
        onClick={submit}
      >
        {side === "buy" ? "Add buy" : "Add sell"}
      </Button>
    </Card>
  );
}
