import { NextRequest, NextResponse } from "next/server";
import type { AssetType, Currency } from "@/lib/types";

// Unified symbol search. ?q=apple&type=stock|crypto
// Returns candidates the add-transaction form can turn into an Asset.
export const revalidate = 0;

export interface SearchResult {
  type: AssetType;
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

function currencyForYahoo(symbol: string, exch?: string): Currency {
  const suffix = symbol.includes(".") ? symbol.split(".").pop()! : "";
  if (IDX_CCY[suffix]) return IDX_CCY[suffix];
  if (exch && exch.toUpperCase().includes("SES")) return "SGD";
  return "USD";
}

async function searchStocks(q: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)" },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = (data?.quotes ?? []) as any[];
    return quotes
      .filter((qt) => qt.symbol && (qt.quoteType === "EQUITY" || qt.quoteType === "ETF"))
      .map((qt) => {
        const suffix = String(qt.symbol).includes(".")
          ? String(qt.symbol).split(".").pop()
          : "";
        return {
          type: "stock" as const,
          symbol: String(qt.symbol).split(".")[0],
          name: qt.shortname || qt.longname || qt.symbol,
          currency: currencyForYahoo(qt.symbol, qt.exchange),
          quoteSource: "yahoo" as const,
          quoteId: qt.symbol,
          lotSize: suffix === "JK" ? 100 : 1,
          exchange: qt.exchDisp,
        };
      });
  } catch {
    return [];
  }
}

async function searchCrypto(q: string): Promise<SearchResult[]> {
  // Yahoo Finance also covers crypto (symbols like "BTC-USD") and is more
  // widely reachable than CoinGecko. We reuse it so crypto and stocks share
  // one quote path and both get a previous close for the day-change figure.
  try {
    const res = await fetch(
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
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = (req.nextUrl.searchParams.get("type") as AssetType) || "stock";
  if (!q || q.length < 1) return NextResponse.json({ results: [] });

  const results =
    type === "crypto" ? await searchCrypto(q) : await searchStocks(q);
  return NextResponse.json({ results });
}
