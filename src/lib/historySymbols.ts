import type { Asset } from "./types";
import { YAHOO_SYMBOL_RE } from "./apiGuards";

type RawSeries = Record<string, { t: number[]; c: number[] }>;

function legacyCryptoYahooSymbol(asset: Asset): string | null {
  const raw = asset.symbol.trim().toUpperCase();
  const base = raw.endsWith("-USD") ? raw.slice(0, -4) : raw;
  const safeBase = base.replace(/[^A-Z0-9]/g, "");
  if (!safeBase) return null;

  const symbol = `${safeBase}-USD`;
  return YAHOO_SYMBOL_RE.test(symbol) ? symbol : null;
}

export function yahooHistorySymbolForAsset(asset: Asset): string | null {
  if (asset.type === "cash") return null;
  if (asset.quoteSource === "yahoo") {
    return YAHOO_SYMBOL_RE.test(asset.quoteId) ? asset.quoteId : null;
  }
  if (asset.type === "crypto" && asset.quoteSource === "coingecko") {
    return legacyCryptoYahooSymbol(asset);
  }
  return null;
}

export function yahooHistorySymbolsForAssets(assets: Asset[]): string[] {
  return [
    ...new Set(
      assets
        .map(yahooHistorySymbolForAsset)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  ].sort();
}

export function aliasYahooHistorySeries(
  assets: Asset[],
  series: RawSeries,
): RawSeries {
  const next: RawSeries = { ...series };

  for (const asset of assets) {
    const historySymbol = yahooHistorySymbolForAsset(asset);
    if (
      historySymbol &&
      historySymbol !== asset.quoteId &&
      series[historySymbol]
    ) {
      next[asset.quoteId] = series[historySymbol];
    }
  }

  return next;
}
