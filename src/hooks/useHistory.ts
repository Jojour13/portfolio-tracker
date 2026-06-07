"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Asset, Currency, Transaction } from "@/lib/types";
import { reconstructTimeSeries } from "@/lib/history";
import {
  aliasYahooHistorySeries,
  yahooHistorySymbolsForAssets,
} from "@/lib/historySymbols";

/**
 * Fetches 5y of daily closes for all priced assets and reconstructs the full
 * portfolio value series. Timeframe slicing happens downstream so we only hit
 * the network once.
 */
export function useHistory(
  assets: Asset[],
  transactions: Transaction[],
  ratesPerUsd: Record<string, number>,
  base: Currency,
) {
  const symbols = useMemo(
    () => yahooHistorySymbolsForAssets(assets).join(","),
    [assets],
  );

  const q = useQuery({
    queryKey: ["history", symbols],
    queryFn: async () => {
      if (!symbols) return { series: {} };
      const res = await fetch(
        `/api/history?symbols=${encodeURIComponent(symbols)}&range=5y`,
      );
      if (!res.ok) throw new Error(`history ${res.status}`);
      return res.json();
    },
    staleTime: 3600_000,
    refetchOnWindowFocus: false,
  });

  const points = useMemo(() => {
    const series = aliasYahooHistorySeries(assets, q.data?.series ?? {});
    if (!assets.length) return [];
    return reconstructTimeSeries(
      assets,
      transactions,
      series,
      ratesPerUsd,
      base,
    );
  }, [q.data, assets, transactions, ratesPerUsd, base]);

  return {
    points,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}
