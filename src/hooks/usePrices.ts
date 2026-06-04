"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Asset, Quote } from "@/lib/types";

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/**
 * Fetch live quotes for every asset (crypto via CoinGecko, stocks via Yahoo)
 * plus USD-based FX rates, polling on the configured interval.
 */
export function usePrices(assets: Asset[], refreshSec: number) {
  const cryptoIds = useMemo(
    () =>
      [
        ...new Set(
          assets
            .filter((a) => a.quoteSource === "coingecko")
            .map((a) => a.quoteId),
        ),
      ]
        .sort()
        .join(","),
    [assets],
  );

  const stockSymbols = useMemo(
    () =>
      [
        ...new Set(
          assets.filter((a) => a.quoteSource === "yahoo").map((a) => a.quoteId),
        ),
      ]
        .sort()
        .join(","),
    [assets],
  );

  const refetchInterval = Math.max(10, refreshSec) * 1000;

  const cryptoQ = useQuery({
    queryKey: ["crypto", cryptoIds],
    queryFn: () => fetchJson(`/api/crypto?ids=${cryptoIds}`),
    enabled: cryptoIds.length > 0,
    refetchInterval,
  });

  const stockQ = useQuery({
    queryKey: ["stocks", stockSymbols],
    queryFn: () => fetchJson(`/api/quote?symbols=${stockSymbols}`),
    enabled: stockSymbols.length > 0,
    refetchInterval,
  });

  const fxQ = useQuery({
    queryKey: ["fx"],
    queryFn: () => fetchJson(`/api/fx`),
    refetchInterval: 3600_000,
    staleTime: 1800_000,
  });

  const quotes = useMemo<Record<string, Quote>>(
    () => ({
      ...((cryptoQ.data?.quotes as Record<string, Quote>) ?? {}),
      ...((stockQ.data?.quotes as Record<string, Quote>) ?? {}),
    }),
    [cryptoQ.data, stockQ.data],
  );

  const ratesPerUsd = useMemo<Record<string, number>>(
    () => (fxQ.data?.rates as Record<string, number>) ?? { USD: 1 },
    [fxQ.data],
  );

  return {
    quotes,
    ratesPerUsd,
    isLoading: cryptoQ.isLoading || stockQ.isLoading || fxQ.isLoading,
    isFetching: cryptoQ.isFetching || stockQ.isFetching,
    lastUpdated: Math.max(
      cryptoQ.dataUpdatedAt ?? 0,
      stockQ.dataUpdatedAt ?? 0,
    ),
    refetch: () => {
      cryptoQ.refetch();
      stockQ.refetch();
      fxQ.refetch();
    },
  };
}
