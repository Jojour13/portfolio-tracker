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
 * Fetch live quotes for every priced asset plus USD-based FX rates, polling on
 * the configured interval. Yahoo handles listed instruments and current crypto
 * search results; CoinGecko remains supported for legacy crypto assets.
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

  const yahooSymbols = useMemo(
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
    queryFn: () => fetchJson(`/api/crypto?ids=${encodeURIComponent(cryptoIds)}`),
    enabled: cryptoIds.length > 0,
    refetchInterval,
  });

  const yahooQ = useQuery({
    queryKey: ["yahoo-quotes", yahooSymbols],
    queryFn: () =>
      fetchJson(`/api/quote?symbols=${encodeURIComponent(yahooSymbols)}`),
    enabled: yahooSymbols.length > 0,
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
      ...((yahooQ.data?.quotes as Record<string, Quote>) ?? {}),
    }),
    [cryptoQ.data, yahooQ.data],
  );

  const ratesPerUsd = useMemo<Record<string, number>>(
    () => (fxQ.data?.rates as Record<string, number>) ?? { USD: 1 },
    [fxQ.data],
  );
  const fxFallback = Boolean(fxQ.data?.fallback);
  const fxError =
    typeof fxQ.data?.error === "string" ? (fxQ.data.error as string) : null;
  const fxAsOf = typeof fxQ.data?.asOf === "string" ? fxQ.data.asOf : null;
  const fxProvider =
    typeof fxQ.data?.provider === "string" ? fxQ.data.provider : null;

  return {
    quotes,
    ratesPerUsd,
    fxFallback,
    fxError,
    fxAsOf,
    fxProvider,
    isLoading: cryptoQ.isLoading || yahooQ.isLoading || fxQ.isLoading,
    isFetching: cryptoQ.isFetching || yahooQ.isFetching,
    lastUpdated: Math.max(
      cryptoQ.dataUpdatedAt ?? 0,
      yahooQ.dataUpdatedAt ?? 0,
    ),
    refetch: () => {
      cryptoQ.refetch();
      yahooQ.refetch();
      fxQ.refetch();
    },
  };
}
