import { NextRequest, NextResponse } from "next/server";
import {
  CURRENCIES,
  TRADEABLE_ASSET_TYPES,
  type SearchableAssetType,
  type Currency,
} from "@/lib/types";
import { fetchWithTimeout, sanitizeSearchQuery } from "@/lib/apiGuards";

// Unified symbol search. ?q=apple&type=stock|crypto|fund|bond|money_market
// Returns candidates the add-transaction form can turn into an Asset.
export const revalidate = 0;

export interface SearchResult {
  type: SearchableAssetType;
  symbol: string; // display ticker
  name: string;
  currency: Currency;
  quoteSource: "yahoo" | "coingecko";
  quoteId: string;
  lotSize: number;
  exchange?: string;
}

const IDX_CCY: Record<string, Currency> = {
  JK: "IDR", // Jakarta (IDX)
  SI: "SGD", // Singapore (SGX)
  SW: "CHF", // SIX Swiss
};

const SUPPORTED_CURRENCIES = new Set<string>(CURRENCIES);

function asSupportedCurrency(value: unknown): Currency | null {
  if (typeof value !== "string") return null;
  const currency = value.toUpperCase();
  return SUPPORTED_CURRENCIES.has(currency) ? (currency as Currency) : null;
}

function currencyForYahoo(
  symbol: string,
  exch?: string,
  rawCurrency?: unknown,
): Currency | null {
  const providerCurrency = asSupportedCurrency(rawCurrency);
  if (providerCurrency) return providerCurrency;
  if (typeof rawCurrency === "string" && rawCurrency.trim().length > 0) {
    return null;
  }

  const suffix = symbol.includes(".") ? symbol.split(".").pop()! : "";
  if (IDX_CCY[suffix]) return IDX_CCY[suffix];
  if (suffix) return null;
  if (exch && exch.toUpperCase().includes("SES")) return "SGD";
  return "USD";
}

function textForYahoo(qt: any) {
  return `${qt.symbol ?? ""} ${qt.shortname ?? ""} ${qt.longname ?? ""} ${qt.quoteType ?? ""}`.toLowerCase();
}

function looksFixedIncome(qt: any) {
  const text = textForYahoo(qt);
  return /\b(bond|fixed income|treasury|t-bill|bill|note|corporate|credit|debt|duration|aggregate bond|municipal|muni|income)\b/.test(text);
}

function looksMoneyMarket(qt: any) {
  const text = textForYahoo(qt);
  return /\b(money market|cash|liquidity|liquid|ultra.?short|overnight|short treasury|t-bill|treasury bill|0-3 month|1-3 month|0-1 year)\b/.test(text);
}

async function searchYahooListed(
  q: string,
  requestedType: Exclude<SearchableAssetType, "crypto">,
): Promise<SearchResult[]> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)" },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = (data?.quotes ?? []) as any[];
    return quotes
      .filter((qt) => {
        if (!qt.symbol) return false;
        if (requestedType === "stock") return qt.quoteType === "EQUITY";
        if (requestedType === "fund") {
          return qt.quoteType === "ETF" || qt.quoteType === "MUTUALFUND";
        }
        if (requestedType === "bond") {
          return (
            (qt.quoteType === "ETF" || qt.quoteType === "MUTUALFUND") &&
            looksFixedIncome(qt) &&
            !looksMoneyMarket(qt)
          );
        }
        return (
          (qt.quoteType === "ETF" ||
            qt.quoteType === "MUTUALFUND" ||
            qt.quoteType === "MONEYMARKET") &&
          looksMoneyMarket(qt)
        );
      })
      .slice(0, 8)
      .map<SearchResult | null>((qt) => {
        const suffix = String(qt.symbol).includes(".")
          ? String(qt.symbol).split(".").pop()
          : "";
        const currency = currencyForYahoo(qt.symbol, qt.exchange, qt.currency);
        if (!currency) return null;
        return {
          type: requestedType,
          symbol: String(qt.symbol).split(".")[0],
          name: qt.shortname || qt.longname || qt.symbol,
          currency,
          quoteSource: "yahoo" as const,
          quoteId: qt.symbol,
          lotSize: suffix === "JK" ? 100 : 1,
          exchange: qt.exchDisp,
        };
      })
      .filter((result): result is SearchResult => result !== null);
  } catch {
    return [];
  }
}

async function searchCrypto(q: string): Promise<SearchResult[]> {
  // Yahoo Finance also covers crypto (symbols like "BTC-USD") and is more
  // widely reachable than CoinGecko. We reuse it so crypto and other
  // Yahoo-backed assets share one quote path and get a previous close.
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)" },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = (data?.quotes ?? []) as any[];
    return quotes
      .filter(
        (qt) =>
          qt.symbol &&
          qt.quoteType === "CRYPTOCURRENCY" &&
          String(qt.symbol).endsWith("-USD"),
      )
      .slice(0, 8)
      .map((qt) => ({
        type: "crypto" as const,
        symbol: String(qt.symbol).replace(/-USD$/, ""),
        name: (qt.shortname || qt.longname || qt.symbol).replace(/ USD$/, ""),
        currency: "USD" as const,
        quoteSource: "yahoo" as const,
        quoteId: qt.symbol,
        lotSize: 1,
        exchange: "Crypto",
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = sanitizeSearchQuery(req.nextUrl.searchParams.get("q"));
  const typeParam = req.nextUrl.searchParams.get("type") ?? "stock";
  const type: SearchableAssetType = TRADEABLE_ASSET_TYPES.includes(
    typeParam as SearchableAssetType,
  )
    ? (typeParam as SearchableAssetType)
    : "stock";
  if (!q) return NextResponse.json({ results: [] });

  const results =
    type === "crypto" ? await searchCrypto(q) : await searchYahooListed(q, type);
  return NextResponse.json({ results });
}
