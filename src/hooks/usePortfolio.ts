"use client";

import { useMemo } from "react";
import { useFolio } from "@/lib/store";
import { buildPositions, valuePortfolio, convert } from "@/lib/portfolio";
import { usePrices } from "./usePrices";

/** The fully-valued portfolio snapshot, recomputed as prices stream in. */
export function usePortfolio() {
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const settings = useFolio((s) => s.settings);

  const { quotes, ratesPerUsd, isLoading, isFetching, lastUpdated, refetch } =
    usePrices(assets, settings.refreshIntervalSec);

  const positions = useMemo(
    () => buildPositions(assets, transactions),
    [assets, transactions],
  );

  const snapshot = useMemo(() => {
    // Realised P/L includes fully-closed positions, so sum across ALL of them.
    const realizedBase = positions.reduce(
      (s, p) =>
        s + convert(p.realizedPnl, p.asset.currency, settings.baseCurrency, ratesPerUsd),
      0,
    );
    return valuePortfolio(
      positions.filter((p) => p.quantity > 0),
      quotes,
      ratesPerUsd,
      settings.baseCurrency,
      realizedBase,
    );
  }, [positions, quotes, ratesPerUsd, settings.baseCurrency]);

  return {
    snapshot,
    base: settings.baseCurrency,
    ratesPerUsd,
    isLoading,
    isFetching,
    lastUpdated,
    refetch,
    hasData: positions.some((p) => p.quantity > 0),
  };
}
