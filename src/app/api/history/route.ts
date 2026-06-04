import { NextRequest, NextResponse } from "next/server";

// Daily close history per symbol via Yahoo Finance chart. Used to reconstruct
// the portfolio's value over time. One request per symbol, run in parallel.
export const revalidate = 0;

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

// app timeframe -> Yahoo range (we always pull a bit extra and slice client-side)
const RANGE_MAP: Record<string, string> = {
  "3d": "1mo",
  "7d": "1mo",
  "1m": "3mo",
  ytd: "ytd",
  "1y": "1y",
  "5y": "5y",
};

interface Series {
  t: number[]; // unix seconds (day)
  c: number[]; // close in native currency
}

async function fetchSeries(symbol: string, range: string): Promise<Series | null> {
  try {
    const res = await fetch(
      `${YF}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Folio/0.1)" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const t: number[] = result?.timestamp ?? [];
    const c: number[] = result?.indicators?.quote?.[0]?.close ?? [];
    if (!t.length || !c.length) return null;
    // drop null closes (market holidays etc.)
    const ts: number[] = [];
    const cs: number[] = [];
    for (let i = 0; i < t.length; i++) {
      if (typeof c[i] === "number") {
        ts.push(t[i]);
        cs.push(c[i]);
      }
    }
    return { t: ts, c: cs };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  const tf = req.nextUrl.searchParams.get("range") ?? "1y";
  const range = RANGE_MAP[tf] ?? "1y";
  if (!symbolsParam) return NextResponse.json({ series: {} });

  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const results = await Promise.all(symbols.map((s) => fetchSeries(s, range)));

  const series: Record<string, Series> = {};
  symbols.forEach((s, i) => {
    if (results[i]) series[s] = results[i]!;
  });

  return NextResponse.json(
    { series },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}
