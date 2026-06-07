"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";
import type {
  Asset,
  AssetType,
  CashFlowType,
  Currency,
  IncomeCategory,
  TxnSide,
} from "@/lib/types";
import {
  ASSET_TYPE_LABEL,
  CURRENCIES,
  INCOME_CATEGORY_LABEL,
  TRADEABLE_ASSET_TYPES,
  type SearchableAssetType,
} from "@/lib/types";
import { useFolio, type NewAssetTxnEntry } from "@/lib/store";
import { usePrices } from "@/hooks/usePrices";
import { TickerSearch } from "./TickerSearch";
import { Button, Card, Input, Label, Select } from "./ui";
import { cn, localIsoDate, uid } from "@/lib/utils";
import {
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedMoney,
} from "@/lib/format";

// How far a same-day entry price may stray from the live market before we block.
const PRICE_TOLERANCE = 0.25;
const UNUSUAL_WITHHOLDING_RATE = 0.6;
const EPSILON = 1e-9;
const MARGIN_ENTRY_ENABLED = false;

type Tab = AssetType;
const ADD_TABS: AssetType[] = [...TRADEABLE_ASSET_TYPES, "cash"];

function isLocalDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function netQuantity(
  transactions: { assetId: string; side: TxnSide; quantity: number; date: string }[],
  assetId: string,
  throughDate?: string,
) {
  return transactions
    .filter((t) => t.assetId === assetId && (!throughDate || t.date <= throughDate))
    .reduce((q, t) => q + (t.side === "buy" ? t.quantity : -t.quantity), 0);
}

export function AddTransactionForm() {
  const router = useRouter();
  const addAssetTransactions = useFolio((s) => s.addAssetTransactions);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);

  const [tab, setTab] = useState<Tab>("crypto");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [cashCcy, setCashCcy] = useState<Currency>("IDR");
  const [cashFlowType, setCashFlowType] =
    useState<Extract<CashFlowType, "external" | "income">>("external");
  const [incomeCategory, setIncomeCategory] =
    useState<IncomeCategory>("dividend");
  const [incomeAssetId, setIncomeAssetId] = useState("");
  const [withholdingTax, setWithholdingTax] = useState("");
  const [side, setSide] = useState<TxnSide>("buy");
  const [qtyInput, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(() => localIsoDate());
  const [note, setNote] = useState("");
  const [margin, setMargin] = useState(false);
  const [leverage, setLeverage] = useState("2");
  const [settleCash, setSettleCash] = useState(true);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const levNum = Math.max(1, parseFloat(leverage) || 1);

  const isCash = tab === "cash";
  const lotSize = picked?.lotSize ?? 1;
  const usesLots = !isCash && lotSize > 1;
  const ccy: Currency = isCash ? cashCcy : (picked?.currency ?? "USD");
  const isIncomeDeposit = isCash && side === "buy" && cashFlowType === "income";

  const qtyNum = parseFloat(qtyInput) || 0;
  const realQty = usesLots ? qtyNum * lotSize : qtyNum;
  const priceNum = isCash ? 1 : parseFloat(price) || 0;
  const parsedFee = fee.trim() === "" ? 0 : Number(fee);
  const invalidFee = !Number.isFinite(parsedFee) || parsedFee < 0;
  const feeNum = invalidFee ? 0 : parsedFee;
  const parsedWithholdingTax =
    withholdingTax.trim() === "" ? 0 : Number(withholdingTax);
  const invalidWithholdingTax =
    isIncomeDeposit &&
    (!Number.isFinite(parsedWithholdingTax) || parsedWithholdingTax < 0);
  const withholdingTaxNum = invalidWithholdingTax ? 0 : parsedWithholdingTax;
  const incomeGrossAmount = isIncomeDeposit
    ? qtyNum + withholdingTaxNum
    : 0;
  const withholdingTaxRate =
    incomeGrossAmount > EPSILON ? withholdingTaxNum / incomeGrossAmount : 0;
  const unusualWithholdingTax =
    isIncomeDeposit &&
    withholdingTaxNum > EPSILON &&
    withholdingTaxRate > UNUSUAL_WITHHOLDING_RATE;
  const gross = realQty * priceNum;
  const total = gross + feeNum;
  const netProceeds = gross - feeNum;

  // --- holding of the target asset (for sell/withdraw max) ---
  const lookupQuoteId = isCash
    ? `cash-${cashCcy.toLowerCase()}`
    : picked?.quoteId;
  const lookupType = isCash ? "cash" : picked?.type;
  const existingAsset = lookupQuoteId
    ? assets.find((a) => a.quoteId === lookupQuoteId && a.type === lookupType)
    : null;
  const dateValid = isLocalDate(date);
  const heldQty = existingAsset ? netQuantity(transactions, existingAsset.id) : 0;
  const availableQty =
    existingAsset && dateValid
      ? netQuantity(transactions, existingAsset.id, date)
      : heldQty;
  const availableDisplay = usesLots ? availableQty / lotSize : availableQty;
  const hasPick = isCash || !!picked;
  const settlementCashAsset = !isCash
    ? assets.find(
        (a) => a.type === "cash" && a.quoteId === `cash-${ccy.toLowerCase()}`,
      )
    : null;
  const settlementCashHeld = settlementCashAsset
    ? netQuantity(transactions, settlementCashAsset.id)
    : 0;
  const settlementCashAvailable =
    settlementCashAsset && dateValid
      ? netQuantity(transactions, settlementCashAsset.id, date)
      : settlementCashHeld;
  const marginEligible =
    !isCash && (tab === "crypto" || tab === "stock" || tab === "fund");
  const marginBuy =
    marginEligible && side === "buy" && MARGIN_ENTRY_ENABLED && margin;
  const cashSettlementAmount =
    side === "buy" ? (marginBuy ? total / levNum : total) : netProceeds;
  const cashSettlementTooMuch =
    !isCash &&
    settleCash &&
    side === "buy" &&
    cashSettlementAmount > settlementCashAvailable + EPSILON;
  const invalidNetProceeds =
    !isCash && settleCash && side === "sell" && netProceeds <= 0;
  const incomeSourceAssets = useMemo(
    () =>
      assets
        .filter((asset) => asset.type !== "cash")
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [assets],
  );
  const incomeSourceAsset = incomeAssetId
    ? incomeSourceAssets.find((asset) => asset.id === incomeAssetId)
    : null;
  const incomeAuditBody =
    withholdingTaxNum > EPSILON && incomeSourceAsset
      ? `Linked to ${incomeSourceAsset.symbol}; ${formatMoney(withholdingTaxNum, ccy)} tax withheld (${formatPercent(withholdingTaxRate, 1)}).`
      : withholdingTaxNum > EPSILON
        ? `${formatMoney(withholdingTaxNum, ccy)} tax withheld (${formatPercent(withholdingTaxRate, 1)}); net received drives cash.`
        : incomeSourceAsset
          ? `Linked to ${incomeSourceAsset.symbol} for audit.`
          : "Raises booked income and portfolio return.";

  // --- live market price, for the sanity check ---
  const priceAssets = useMemo<Asset[]>(
    () =>
      picked
        ? [
            {
              id: "probe",
              type: picked.type,
              symbol: picked.symbol,
              name: picked.name,
              currency: picked.currency,
              quoteSource: picked.quoteSource,
              quoteId: picked.quoteId,
              lotSize,
            },
          ]
        : [],
    [picked, lotSize],
  );
  const { quotes } = usePrices(priceAssets, 60);
  const marketPrice = picked ? quotes[picked.quoteId]?.price ?? null : null;

  // --- validation ---
  const today = localIsoDate();
  // Only sanity-check the price for a *same-day* trade — past/future dates
  // legitimately have different prices we can't validate against live data.
  const isTodayEntry = dateValid && date === today;
  const sellTooMuch =
    side === "sell" &&
    hasPick &&
    dateValid &&
    realQty > availableQty + EPSILON;
  const priceDeviation =
    !isCash && marketPrice && priceNum > 0
      ? Math.abs(priceNum - marketPrice) / marketPrice
      : 0;
  const priceOutOfRange =
    !isCash &&
    isTodayEntry &&
    marketPrice != null &&
    priceNum > 0 &&
    priceDeviation > PRICE_TOLERANCE;

  const canSubmit = isCash
    ? dateValid &&
      qtyNum > 0 &&
      !sellTooMuch &&
      !invalidFee &&
      !invalidWithholdingTax
    : picked &&
      dateValid &&
      qtyNum > 0 &&
      priceNum > 0 &&
      !invalidFee &&
      !sellTooMuch &&
      !priceOutOfRange &&
      !cashSettlementTooMuch &&
      !invalidNetProceeds;

  const summaryAmount = isCash || side === "buy" ? total : netProceeds;
  const cashLedgerImpact = isCash
    ? side === "buy"
      ? qtyNum
      : -qtyNum
    : settleCash
      ? side === "buy"
        ? -cashSettlementAmount
        : cashSettlementAmount
      : null;
  const cashLedgerTone =
    cashLedgerImpact === null || Math.abs(cashLedgerImpact) <= EPSILON
      ? "text-zinc-400"
      : cashLedgerImpact > 0
        ? "text-emerald-300"
        : "text-rose-300";
  const cashLedgerSummary =
    cashLedgerImpact === null
      ? "No cash change"
      : formatSignedMoney(cashLedgerImpact, ccy);
  const cashLedgerDetail = isCash
    ? side === "buy"
      ? cashFlowType === "income"
        ? "Booked to cash and income."
        : "Booked as external cash funding."
      : "Booked as an external withdrawal."
    : settleCash
      ? side === "buy"
        ? `${ccy} cash pays for this trade.`
        : `${ccy} cash receives sale proceeds.`
      : "Cash balance is not updated.";
  const performanceTreatment = isCash
    ? side === "buy"
      ? cashFlowType === "income"
        ? {
            label: `Included as ${INCOME_CATEGORY_LABEL[incomeCategory].toLowerCase()}`,
            body: incomeAuditBody,
            tone: "text-emerald-300",
          }
        : {
            label: "Excluded external deposit",
            body: "Adds funding without lifting TWR.",
            tone: "text-zinc-300",
          }
      : {
          label: "Excluded external withdrawal",
          body: "Removes funding without lowering TWR.",
          tone: "text-zinc-300",
        }
    : settleCash
      ? {
          label: "Internal cash settlement",
          body:
            side === "buy"
              ? "Pairs the buy with cash outflow."
              : "Pairs the sale with cash inflow.",
          tone: "text-sky-300",
        }
      : {
          label: side === "buy" ? "External contribution" : "External withdrawal",
          body:
            side === "buy"
              ? "Asset enters without reducing cash."
              : "Asset leaves without adding cash.",
          tone: "text-amber-300",
        };

  function resetPickerFor(t: Tab) {
    setTab(t);
    setPicked(null);
    setQty("");
    setPrice("");
  }

  function submit() {
    setFormError(null);
    let assetInput: NewAssetTxnEntry["asset"];
    if (isCash) {
      assetInput = {
        type: "cash",
        symbol: cashCcy,
        name: `Cash (${cashCcy})`,
        currency: cashCcy,
        quoteSource: "cash",
        quoteId: `cash-${cashCcy.toLowerCase()}`,
        lotSize: 1,
      };
    } else if (picked) {
      assetInput = {
        type: picked.type,
        symbol: picked.symbol,
        name: picked.name,
        currency: picked.currency,
        quoteSource: picked.quoteSource,
        quoteId: picked.quoteId,
        lotSize: picked.lotSize,
      };
    } else {
      return;
    }

    const settlementId =
      !isCash && picked && settleCash && cashSettlementAmount > 0
        ? "s-" + uid()
        : undefined;

    const entries: NewAssetTxnEntry[] = [
      {
        asset: assetInput,
        txn: {
          side,
          quantity: realQty,
          price: priceNum,
          fee: feeNum,
          date,
          note: note || undefined,
          settlementId,
          cashFlowType: isCash
            ? side === "buy"
              ? cashFlowType
              : "external"
            : undefined,
          incomeCategory: isIncomeDeposit ? incomeCategory : undefined,
          incomeAssetId:
            isIncomeDeposit && incomeAssetId
              ? incomeAssetId
              : undefined,
          withholdingTax:
            isIncomeDeposit && withholdingTaxNum > 0
              ? withholdingTaxNum
              : undefined,
          margin: marginBuy ? true : undefined,
          leverage: marginBuy ? levNum : undefined,
        },
      },
    ];

    if (settlementId && !isCash && picked) {
      entries.push({
        asset: {
          type: "cash",
          symbol: ccy,
          name: `Cash (${ccy})`,
          currency: ccy,
          quoteSource: "cash",
          quoteId: `cash-${ccy.toLowerCase()}`,
          lotSize: 1,
        },
        txn: {
          side: side === "buy" ? "sell" : "buy",
          quantity: cashSettlementAmount,
          price: 1,
          fee: 0,
          date,
          settlementId,
          cashFlowType: "settlement",
          note:
            side === "buy"
              ? `Settlement for ${picked.symbol} buy`
              : `Proceeds from ${picked.symbol} sell`,
        },
      });
    }

    const result = addAssetTransactions(entries);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

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
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900/60 p-1 sm:grid-cols-3">
        {ADD_TABS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => resetPickerFor(t)}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
              tab === t
                ? "bg-zinc-700 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {ASSET_TYPE_LABEL[t]}
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
            onQueryChange={() => {
              setPicked(null);
              setPrice("");
            }}
          />
          {tab === "bond" && (
            <p className="mt-1.5 text-xs text-amber-300/90">
              Use listed bond funds or ETFs here. Individual bonds with coupon,
              maturity, face-value, and accrued-interest accounting are not
              modeled yet.
            </p>
          )}
          {tab === "money_market" && (
            <p className="mt-1.5 text-xs text-zinc-500">
              Money market instruments are valued by ticker price or NAV. Yield
              accrual is reflected only through market/NAV changes or income
              entries.
            </p>
          )}
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
            type="button"
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

      {isCash && side === "buy" && (
        <div className="mb-4">
          <Label>Cash source</Label>
          <Select
            value={cashFlowType}
            onChange={(e) =>
              setCashFlowType(
                e.target.value as Extract<CashFlowType, "external" | "income">,
              )
            }
          >
            <option value="external">External deposit</option>
            <option value="income">Dividend / interest / income</option>
          </Select>
          <p className="mt-1.5 text-xs text-zinc-500">
            Income increases performance return; external deposits are excluded
            from time-weighted return.
          </p>
          {cashFlowType === "income" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Income category</Label>
                <Select
                  value={incomeCategory}
                  onChange={(e) =>
                    setIncomeCategory(e.target.value as IncomeCategory)
                  }
                >
                  {Object.entries(INCOME_CATEGORY_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Source holding</Label>
                <Select
                  value={incomeAssetId}
                  onChange={(e) => setIncomeAssetId(e.target.value)}
                >
                  <option value="">Unlinked</option>
                  {incomeSourceAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol} - {asset.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tax withheld ({ccy})</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="0"
                  value={withholdingTax}
                  onChange={(e) => setWithholdingTax(e.target.value)}
                  className={
                    invalidWithholdingTax ? "border-rose-500" : undefined
                  }
                />
                {invalidWithholdingTax && (
                  <p className="mt-1 text-[11px] text-rose-400">
                    Tax withheld must be zero or greater.
                  </p>
                )}
                {!invalidWithholdingTax && withholdingTaxNum > EPSILON && (
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      unusualWithholdingTax
                        ? "text-amber-300"
                        : "text-zinc-500",
                    )}
                  >
                    {formatPercent(withholdingTaxRate, 1)} of gross income
                    withheld
                    {unusualWithholdingTax
                      ? ". Check whether the amount field is net received, not gross income."
                      : "."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* numeric inputs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">
              {isIncomeDeposit
                ? `Net received (${ccy})`
                : isCash
                  ? `Amount (${ccy})`
                  : usesLots
                    ? "Lots"
                    : "Quantity"}
            </Label>
            {side === "sell" && hasPick && availableQty > EPSILON && (
              <button
                type="button"
                onClick={() =>
                  setQty(String(usesLots ? availableDisplay : availableQty))
                }
                className="text-[11px] font-medium text-indigo-400 hover:underline"
              >
                Max {formatNumber(availableDisplay, usesLots ? 0 : 4)}
              </button>
            )}
          </div>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={usesLots ? "10" : "0.00"}
            value={qtyInput}
            onChange={(e) => setQty(e.target.value)}
            className={sellTooMuch ? "border-rose-500" : undefined}
          />
          {usesLots && qtyNum > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500">
              = {realQty.toLocaleString()} shares
            </p>
          )}
          {sellTooMuch && (
            <p className="mt-1 text-[11px] text-rose-400">
              Available on {date}:{" "}
              {formatNumber(availableDisplay, usesLots ? 0 : 4)}{" "}
              {isCash ? ccy : usesLots ? "lots" : "units"}. Later{" "}
              {isCash ? "deposits" : "buys"} cannot fund a back-dated{" "}
              {isCash ? "withdrawal" : "sell"}.
            </p>
          )}
          {side === "sell" && hasPick && dateValid && availableQty <= EPSILON && (
            <p className="mt-1 text-[11px] text-rose-400">
              No {isCash ? ccy : picked?.symbol} is available on {date} to{" "}
              {isCash ? "withdraw" : "sell"}.
            </p>
          )}
        </div>

        {!isCash && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="mb-0">Price / unit ({ccy})</Label>
              {marketPrice != null && (
                <button
                  type="button"
                  onClick={() => setPrice(String(marketPrice))}
                  className="text-[11px] font-medium text-indigo-400 hover:underline"
                  title="Use the current market price"
                >
                  Mkt {formatMoney(marketPrice, ccy)}
                </button>
              )}
            </div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={priceOutOfRange ? "border-rose-500" : undefined}
            />
            {priceOutOfRange && marketPrice != null && (
              <p className="mt-1 text-[11px] text-rose-400">
                That&apos;s {(priceDeviation * 100).toFixed(0)}% off the market (
                {formatMoney(marketPrice, ccy)}). Check the price, or back-date
                the trade if it&apos;s historical.
              </p>
            )}
          </div>
        )}

        <div>
          <Label>Fee ({ccy})</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={invalidFee ? "border-rose-500" : undefined}
          />
          {invalidFee && (
            <p className="mt-1 text-[11px] text-rose-400">
              Fee must be zero or greater.
            </p>
          )}
        </div>

        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={!dateValid ? "border-rose-500" : undefined}
          />
          {!dateValid && (
            <p className="mt-1 text-[11px] text-rose-400">
              Enter a valid trade date.
            </p>
          )}
        </div>
      </div>

      {marginEligible && side === "buy" && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={MARGIN_ENTRY_ENABLED && margin}
              disabled={!MARGIN_ENTRY_ENABLED}
              onChange={(e) => setMargin(MARGIN_ENTRY_ENABLED && e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-amber-500"
            />
            <span className="text-sm font-medium text-zinc-200">
              Use margin / leverage
            </span>
          </label>

          {!MARGIN_ENTRY_ENABLED && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300/90">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Margin entry is paused for release until Folio can model debt
              repayment and broker financing costs end to end.
            </p>
          )}

          {MARGIN_ENTRY_ENABLED && margin && (
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

      {!isCash && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={settleCash}
              onChange={(e) => setSettleCash(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-500"
            />
            <span className="text-sm font-medium text-zinc-200">
              Update {ccy} cash balance
            </span>
          </label>
          <div className="mt-2 rounded-lg bg-zinc-950/30 px-3 py-2 text-xs text-zinc-500">
            {settleCash ? (
              <>
                This {side} will also{" "}
                <span className={side === "buy" ? "text-rose-300" : "text-emerald-300"}>
                  {side === "buy" ? "withdraw" : "deposit"}{" "}
                  {formatMoney(cashSettlementAmount, ccy)}
                </span>{" "}
                {side === "buy" ? "from" : "to"} your {ccy} cash ledger.
              </>
            ) : (
              <>
                Cash will not change. Use this when the trade is already settled
                elsewhere or you only want to track the asset position.
              </>
            )}
            <div className="mt-1">
              Recorded {ccy} cash on {date || "selected date"}:{" "}
              {formatMoney(settlementCashAvailable, ccy, { compact: true })}
            </div>
            {Math.abs(settlementCashAvailable - settlementCashHeld) > EPSILON && (
              <div className="mt-1">
                Current {ccy} cash:{" "}
                {formatMoney(settlementCashHeld, ccy, { compact: true })}
              </div>
            )}
            {marginBuy && (
              <div className="mt-1 text-amber-300/90">
                Margin buy: cash impact uses your {levNum}x equity contribution,
                not the full notional.
              </div>
            )}
          </div>
          {cashSettlementTooMuch && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Not enough recorded {ccy} cash on {date} for this buy. Deposit
              cash earlier, choose a later trade date, or turn off cash
              settlement for this entry.
            </p>
          )}
          {invalidNetProceeds && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Fees are larger than the sell proceeds, so Folio cannot record a
              positive cash deposit.
            </p>
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
      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {isCash
              ? isIncomeDeposit
                ? "Net received"
                : "Amount"
              : side === "buy"
                ? "Total cost"
                : "Net proceeds"}
          </span>
          <span className="text-lg font-semibold text-white tabular">
            {formatMoney(summaryAmount, ccy)}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {isCash &&
            isIncomeDeposit &&
            withholdingTaxNum > EPSILON && (
              <div className="rounded-lg bg-zinc-950/30 px-3 py-2 sm:col-span-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Gross income
                </div>
                <div className="text-sm font-semibold text-white tabular">
                  {formatMoney(incomeGrossAmount, ccy)}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {formatMoney(withholdingTaxNum, ccy)} withheld (
                  {formatPercent(withholdingTaxRate, 1)})
                </div>
              </div>
            )}
          <div className="rounded-lg bg-zinc-950/30 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Cash ledger
            </div>
            <div className={cn("text-sm font-semibold tabular", cashLedgerTone)}>
              {cashLedgerSummary}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {cashLedgerDetail}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-950/30 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Performance treatment
            </div>
            <div className={cn("text-sm font-semibold", performanceTreatment.tone)}>
              {performanceTreatment.label}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {performanceTreatment.body}
            </div>
          </div>
        </div>
      </div>

      {formError && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}

      <Button
        className="mt-4 w-full"
        disabled={!canSubmit}
        onClick={submit}
      >
        {isCash
          ? side === "buy"
            ? cashFlowType === "income"
              ? "Add income"
              : "Add deposit"
            : "Add withdrawal"
          : side === "buy"
            ? "Add buy"
            : "Add sell"}
      </Button>
    </Card>
  );
}
