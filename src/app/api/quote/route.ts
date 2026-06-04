import { NextRequest, NextResponse } from "next/server";
import type { Quote } from "@/lib/types";

// Stock quotes (US / SGX / IDX) via Yahoo Finance's public chart endpoint.
// The chart endpoint works without auth and returns price + previous close +
// the native currency in `meta`. We fetch each symbol in parallel.
export const revalidate = 0;

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

async function fetchOne(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `${YF}/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)",
          accept: "application/json",
        },
        next: { revalidate: 20 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      quoteId: symbol,
      price: meta.regularMarketPrice,
      prevClose:
        typeof meta.chartPreviousClose === "number"
          ? meta.chartPreviousClose
          : typeof meta.previousClose === "number"
            ? meta.previousClose
            : null,
      currency: meta.currency,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) return NextResponse.json({ quotes: {} });

  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const results = await Promise.all(symbols.map(fetchOne));

  const quotes: Record<string, Quote> = {};
  for (const q of results) if (q) quotes[q.quoteId] = q;

  return NextResponse.json(
    { quotes },
    { headers: { "Cache-Control": "s-maxage=20, stale-while-revalidate=40" } },
  );
}
