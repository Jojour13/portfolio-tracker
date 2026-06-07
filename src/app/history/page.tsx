"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Download,
} from "lucide-react";
import { useFolio } from "@/lib/store";
import { Card, Badge, Button } from "@/components/ui";
import { Money } from "@/components/Money";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn, localIsoDate } from "@/lib/utils";
import {
  ASSET_TYPE_LABEL,
  ASSET_TYPES,
  INCOME_CATEGORY_LABEL,
  type AssetType,
  type CashFlowType,
  type IncomeCategory,
} from "@/lib/types";
import { cashFlowTypeForTransaction } from "@/lib/cashFlow";

const TYPE_STYLE: Record<AssetType, string> = {
  crypto: "bg-amber-500/15 text-amber-300",
  stock: "bg-sky-500/15 text-sky-300",
  fund: "bg-cyan-500/15 text-cyan-300",
  bond: "bg-violet-500/15 text-violet-300",
  money_market: "bg-teal-500/15 text-teal-300",
  cash: "bg-emerald-500/15 text-emerald-300",
};

const CASH_FLOW_BADGE: Record<
  CashFlowType,
  { label: string; className: string }
> = {
  external: {
    label: "external flow",
    className: "bg-zinc-700/70 text-zinc-300",
  },
  income: {
    label: "income",
    className: "bg-emerald-500/15 text-emerald-300",
  },
  transfer: {
    label: "FX transfer",
    className: "bg-sky-500/15 text-sky-300",
  },
  settlement: {
    label: "settlement",
    className: "bg-indigo-500/15 text-indigo-300",
  },
};

type TypeFilter = "all" | AssetType;
type FlowFilter = "all" | CashFlowType;
type IncomeFilter = "all" | "uncategorized" | IncomeCategory;

const FLOW_FILTERS: { key: FlowFilter; label: string }[] = [
  { key: "all", label: "all flows" },
  { key: "income", label: "income" },
  { key: "settlement", label: "settlement" },
  { key: "transfer", label: "FX transfer" },
  { key: "external", label: "external" },
];

const INCOME_FILTERS: { key: IncomeFilter; label: string }[] = [
  { key: "all", label: "all income" },
  ...Object.entries(INCOME_CATEGORY_LABEL).map(([key, label]) => ({
    key: key as IncomeCategory,
    label,
  })),
  { key: "uncategorized", label: "uncategorized" },
];

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  // Leading apostrophe prevents spreadsheet formula execution on exported notes/names.
  const raw =
    typeof value === "string" && (/^[\t\r\n]/.test(value) || /^\s*[=+\-@]/.test(value))
      ? `'${value}`
      : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const deleteTransactions = useFolio((s) => s.deleteTransactions);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("all");
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<{
    ids: string[];
    label: string;
    linked: boolean;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  const rows = useMemo(() => {
    return [...transactions]
      .map((t) => {
        const asset = assetMap[t.assetId];
        return {
          t,
          asset,
          cashFlowType: asset ? cashFlowTypeForTransaction(asset, t) : null,
          incomeSource: t.incomeAssetId ? assetMap[t.incomeAssetId] : null,
        };
      })
      .filter((r) => r.asset && (filter === "all" || r.asset.type === filter))
      .filter(
        (r) =>
          flowFilter === "all" ||
          r.cashFlowType === flowFilter ||
          (flowFilter === "settlement" && !!r.t.settlementId),
      )
      .filter((r) => {
        if (incomeFilter === "all") return true;
        if (r.cashFlowType !== "income") return false;
        return incomeFilter === "uncategorized"
          ? !r.t.incomeCategory
          : r.t.incomeCategory === incomeFilter;
      })
      .sort((a, b) => b.t.date.localeCompare(a.t.date) || b.t.id.localeCompare(a.t.id));
  }, [transactions, assetMap, filter, flowFilter, incomeFilter]);

  const filterActive =
    filter !== "all" || flowFilter !== "all" || incomeFilter !== "all";
  const emptyLabel =
    incomeFilter !== "all"
      ? `No ${INCOME_FILTERS.find((item) => item.key === incomeFilter)?.label ?? "income"} transactions.`
      : flowFilter !== "all"
      ? `No ${CASH_FLOW_BADGE[flowFilter].label} transactions.`
      : filter === "all"
        ? "No transactions yet."
        : `No ${ASSET_TYPE_LABEL[filter].toLowerCase()} transactions.`;

  function exportCsv() {
    const header = [
      "id",
      "date",
      "asset_type",
      "symbol",
      "name",
      "side",
      "quantity_base_units",
      "quantity_display",
      "display_unit",
      "price",
      "currency",
      "fee",
      "note",
      "settlement_group",
      "cash_flow_type",
      "income_category",
      "income_source",
      "withholding_tax",
      "gross_income_native",
      "withholding_tax_rate",
      "margin",
      "leverage",
    ];
    const body = rows.map(({ t, asset, cashFlowType, incomeSource }) => {
      const usesLots = asset.lotSize > 1;
      const netIncome =
        asset.type === "cash" && cashFlowType === "income"
          ? t.quantity * t.price
          : null;
      const withholdingTax = t.withholdingTax ?? 0;
      const grossIncome =
        netIncome !== null ? netIncome + withholdingTax : null;
      const withholdingRate =
        grossIncome && withholdingTax > 0 ? withholdingTax / grossIncome : null;
      return [
        t.id,
        t.date,
        asset.type,
        asset.symbol,
        asset.name,
        asset.type === "cash" ? (t.side === "buy" ? "deposit" : "withdraw") : t.side,
        t.quantity,
        usesLots ? t.quantity / asset.lotSize : t.quantity,
        asset.type === "cash" ? asset.currency : usesLots ? "lots" : "units",
        t.price,
        asset.currency,
        t.fee,
        t.note ?? "",
        t.settlementId ?? "",
        cashFlowType ?? "",
        t.incomeCategory ?? "",
        incomeSource?.symbol ?? t.incomeAssetId ?? "",
        t.withholdingTax ?? "",
        grossIncome ?? "",
        withholdingRate ?? "",
        Boolean(t.margin),
        t.leverage ?? "",
      ];
    });

    const suffix =
      incomeFilter !== "all"
        ? `${filter}-${flowFilter}-${incomeFilter}`
        : flowFilter === "all"
          ? filter
          : `${filter}-${flowFilter}`;
    downloadCsv(`folio-${suffix}-transactions-${localIsoDate()}.csv`, [
      header,
      ...body,
    ]);
  }

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
            {filterActive
              ? `${rows.length} of ${transactions.length} transactions`
              : `${transactions.length} transactions`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download size={14} />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">CSV</span>
        </Button>
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...ASSET_TYPES] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => {
              setFilter(f);
              if (f !== "all" && f !== "cash") {
                setFlowFilter("all");
                setIncomeFilter("all");
              }
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {f === "all" ? "All" : ASSET_TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FLOW_FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => {
              setFlowFilter(f.key);
              if (f.key !== "all") setFilter("all");
              if (f.key !== "income") setIncomeFilter("all");
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              flowFilter === f.key
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {flowFilter === "income" && (
        <div className="flex flex-wrap gap-1.5">
          {INCOME_FILTERS.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => {
                setIncomeFilter(f.key);
                setFilter("all");
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                incomeFilter === f.key
                  ? "bg-emerald-600/80 text-white"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Delete transaction?</div>
            <p className="text-xs text-rose-100/75">
              {pendingDelete.label} will be removed from the audit trail and
              portfolio calculations.
              {pendingDelete.linked &&
                " This will delete the linked trade and cash settlement rows together."}
            </p>
            {deleteError && (
              <p className="mt-2 text-xs text-amber-100">{deleteError}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPendingDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                const result = deleteTransactions(pendingDelete.ids);
                if (!result.ok) {
                  setDeleteError(result.error);
                  return;
                }
                setPendingDelete(null);
                setDeleteError(null);
              }}
            >
              {pendingDelete.linked ? "Delete pair" : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center text-zinc-500">
          <p>
            {emptyLabel}
          </p>
          <Link href="/add">
            <Button size="sm">
              <PlusCircle size={14} /> Add transaction
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-800/70">
          {rows.map(({ t, asset, cashFlowType, incomeSource }) => {
            const isBuy = t.side === "buy";
            const lots = asset.lotSize > 1 ? t.quantity / asset.lotSize : null;
            const cashFlowBadge = cashFlowType
              ? CASH_FLOW_BADGE[cashFlowType]
              : null;
            const incomeCategoryLabel = t.incomeCategory
              ? INCOME_CATEGORY_LABEL[t.incomeCategory]
              : null;
            const withholdingTax =
              t.withholdingTax && t.withholdingTax > 0
                ? t.withholdingTax
                : null;
            const grossIncome =
              asset.type === "cash" &&
              cashFlowType === "income" &&
              withholdingTax
                ? t.quantity * t.price + withholdingTax
                : null;
            const withholdingRate =
              grossIncome && grossIncome > 0 && withholdingTax
                ? withholdingTax / grossIncome
                : null;
            return (
              <div
                key={t.id}
                className="group grid grid-cols-[auto_1fr] gap-3 px-4 py-3.5 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:px-5"
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

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-semibold text-white">
                      {asset.symbol}
                    </span>
                    <Badge className={TYPE_STYLE[asset.type]}>
                      {ASSET_TYPE_LABEL[asset.type]}
                    </Badge>
                    {t.settlementId && (
                      <Badge className="bg-indigo-500/15 text-indigo-300">
                        linked
                      </Badge>
                    )}
                    {asset.type === "cash" && cashFlowBadge && (
                      <Badge className={cashFlowBadge.className}>
                        {cashFlowBadge.label}
                      </Badge>
                    )}
                    {incomeCategoryLabel && (
                      <Badge className="bg-emerald-500/15 text-emerald-300">
                        {incomeCategoryLabel}
                      </Badge>
                    )}
                    {incomeSource && (
                      <Badge className="bg-sky-500/15 text-sky-300">
                        from {incomeSource.symbol}
                      </Badge>
                    )}
                    {withholdingTax && (
                      <Badge
                        className="bg-amber-500/15 text-amber-300"
                        title={`${formatMoney(withholdingTax, asset.currency)} withheld`}
                      >
                        tax{" "}
                        {withholdingRate !== null
                          ? formatPercent(withholdingRate, 1)
                          : formatMoney(withholdingTax, asset.currency, {
                              compact: true,
                            })}
                      </Badge>
                    )}
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

                <div className="col-start-2 row-start-2 text-left sm:col-auto sm:row-auto sm:text-right">
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
                  type="button"
                  onClick={() => {
                    const linkedIds = t.settlementId
                      ? transactions
                          .filter((x) => x.settlementId === t.settlementId)
                          .map((x) => x.id)
                      : [t.id];
                    setPendingDelete({
                      ids: linkedIds.length > 0 ? linkedIds : [t.id],
                      label: `${asset.symbol} ${isBuy ? "buy" : "sell"} on ${t.date}`,
                      linked: linkedIds.length > 1,
                    });
                    setDeleteError(null);
                  }}
                  className="col-start-2 row-start-2 justify-self-end rounded-lg p-2 text-zinc-600 opacity-100 transition hover:bg-rose-500/10 hover:text-rose-400 sm:col-auto sm:row-auto md:opacity-0 md:group-hover:opacity-100"
                  title="Delete transaction"
                  aria-label={`Delete ${asset.symbol} transaction`}
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
