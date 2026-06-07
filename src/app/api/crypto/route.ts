import { NextRequest, NextResponse } from "next/server";
import type { Quote } from "@/lib/types";
import {
  COINGECKO_ID_RE,
  MAX_CRYPTO_IDS,
  fetchWithTimeout,
  parseCsvList,
} from "@/lib/apiGuards";

// Legacy CoinGecko quote endpoint for older crypto assets whose quoteSource is
// "coingecko". New crypto search results use Yahoo symbols via /api/quote.
// We ask for the 24h change so we can derive the previous close.
export const revalidate = 0;

const LEGACY_YAHOO_CRYPTO: Record<string, string> = {
  bitcoin: "BTC-USD",
  ethereum: "ETH-USD",
  solana: "SOL-USD",
  cardano: "ADA-USD",
  dogecoin: "DOGE-USD",
  ripple: "XRP-USD",
  litecoin: "LTC-USD",
  chainlink: "LINK-USD",
  polkadot: "DOT-USD",
  "avalanche-2": "AVAX-USD",
};

async function fetchYahooFallback(id: string): Promise<Quote | null> {
  const symbol = LEGACY_YAHOO_CRYPTO[id];
  if (!symbol) return null;

  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)",
          accept: "application/json",
        },
        next: { revalidate: 30 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      quoteId: id,
      price: meta.regularMarketPrice,
      prevClose:
        typeof meta.chartPreviousClose === "number"
          ? meta.chartPreviousClose
          : typeof meta.previousClose === "number"
            ? meta.previousClose
            : null,
      currency: "USD",
      source: "yahoo",
      asOf:
        typeof meta.regularMarketTime === "number"
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : undefined,
      marketState: meta.marketState,
      delayed: true,
    };
  } catch {
    return null;
  }
}

async function fetchYahooFallbacks(ids: string[]) {
  const entries = await Promise.all(
    ids.map(async (id) => [id, await fetchYahooFallback(id)] as const),
  );
  const quotes: Record<string, Quote> = {};
  for (const [id, quote] of entries) {
    if (quote) quotes[id] = quote;
  }
  return quotes;
}

export async function GET(req: NextRequest) {
  const parsed = parseCsvList(req.nextUrl.searchParams.get("ids"), {
    label: "crypto ids",
    maxItems: MAX_CRYPTO_IDS,
    maxLength: 64,
    pattern: COINGECKO_ID_RE,
  });
  if (!parsed.ok) {
    return NextResponse.json({ quotes: {}, error: parsed.error }, { status: 400 });
  }
  if (!parsed.values.length) return NextResponse.json({ quotes: {} });
  const ids = parsed.values.join(",");

  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${encodeURIComponent(ids)}` +
    `&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const data = (await res.json()) as Record<
      string,
      { usd: number; usd_24h_change?: number }
    >;

    const quotes: Record<string, Quote> = {};
    for (const [id, v] of Object.entries(data)) {
      const change = (v.usd_24h_change ?? 0) / 100;
      quotes[id] = {
        quoteId: id,
        price: v.usd,
        prevClose: change !== -1 ? v.usd / (1 + change) : null,
        currency: "USD",
        source: "coingecko",
        asOf: new Date().toISOString(),
        delayed: false,
      };
    }
    const missingIds = parsed.values.filter((id) => !quotes[id]);
    const fallbackQuotes = await fetchYahooFallbacks(missingIds);
    Object.assign(quotes, fallbackQuotes);
    return NextResponse.json(
      {
        quotes,
        fallback: Object.keys(fallbackQuotes).length > 0,
      },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    const fallbackQuotes = await fetchYahooFallbacks(parsed.values);
    return NextResponse.json(
      {
        quotes: fallbackQuotes,
        fallback: Object.keys(fallbackQuotes).length > 0,
        error:
          Object.keys(fallbackQuotes).length > 0
            ? "CoinGecko unavailable; used Yahoo fallback for supported legacy crypto ids."
            : String(e),
      },
      { status: 200 },
    );
  }
}
