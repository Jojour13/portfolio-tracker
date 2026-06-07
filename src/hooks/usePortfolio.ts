"use client";

import { useMemo } from "react";
import { useFolio } from "@/lib/store";
import { buildPositions, valuePortfolio, convertOrNull } from "@/lib/portfolio";
import { usePrices } from "./usePrices";
import { cashFlowTypeForTransaction } from "@/lib/cashFlow";

/** The fully-valued portfolio snapshot, recomputed as prices stream in. */
export function usePortfolio() {
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const settings = useFolio((s) => s.settings);

  const {
    quotes,
    ratesPerUsd,
    fxFallback,
    fxError,
    fxAsOf,
    fxProvider,
    isLoading,
    isFetching,
    lastUpdated,
    refetch,
  } = usePrices(assets, settings.refreshIntervalSec);

  const positions = useMemo(
    () => buildPositions(assets, transactions),
    [assets, transactions],
  );

  const snapshot = useMemo(() => {
    // Realised P/L includes fully-closed positions, so sum across ALL of them.
    const realized = positions.reduce(
      (acc, p) => {
        if (Math.abs(p.realizedPnl) <= 1e-12) return acc;
        const converted = convertOrNull(
          p.realizedPnl,
          p.asset.currency,
          settings.baseCurrency,
          ratesPerUsd,
        );
        if (converted === null) acc.missing += 1;
        else acc.total += converted;
        return acc;
      },
      { total: 0, missing: 0 },
    );
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const income = transactions.reduce(
      (acc, transaction) => {
        const asset = assetById.get(transaction.assetId);
        if (!asset || cashFlowTypeForTransaction(asset, transaction) !== "income") {
          return acc;
        }
        const convertedIncome = convertOrNull(
          transaction.quantity * transaction.price,
          asset.currency,
          settings.baseCurrency,
          ratesPerUsd,
        );
        if (convertedIncome === null) acc.missing += 1;
        else acc.total += convertedIncome;

        const withholdingTax = transaction.withholdingTax ?? 0;
        if (withholdingTax > 0) {
          const convertedTax = convertOrNull(
            withholdingTax,
            asset.currency,
            settings.baseCurrency,
            ratesPerUsd,
          );
          if (convertedTax === null) acc.taxMissing += 1;
          else acc.taxTotal += convertedTax;
        }
        return acc;
      },
      { total: 0, missing: 0, taxTotal: 0, taxMissing: 0 },
    );
    return valuePortfolio(
      positions.filter((p) => p.quantity > 0),
      quotes,
      ratesPerUsd,
      settings.baseCurrency,
      realized.total,
      realized.missing,
      income.total,
      income.missing,
      income.taxTotal,
      income.taxMissing,
    );
  }, [assets, positions, quotes, ratesPerUsd, settings.baseCurrency, transactions]);

  return {
    snapshot,
    base: settings.baseCurrency,
    ratesPerUsd,
    fxFallback,
    fxError,
    fxAsOf,
    fxProvider,
    isLoading,
    isFetching,
    lastUpdated,
    refetch,
    hasOpenPositions: positions.some((p) => p.quantity > 0),
    hasActivity: transactions.length > 0,
  };
}
