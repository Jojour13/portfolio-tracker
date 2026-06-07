import { NextRequest, NextResponse } from "next/server";
import {
  MAX_HISTORY_SYMBOLS,
  YAHOO_SYMBOL_RE,
  fetchWithTimeout,
  parseCsvList,
} from "@/lib/apiGuards";

// Daily close history per symbol via Yahoo Finance chart. Used to reconstruct
// the portfolio's value over time. One request per symbol, run in parallel.
export const revalidate = 0;

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

// app timeframe -> Yahoo {range, interval}. 1D is intraday (5-minute bars).
const TF_MAP: Record<string, { range: string; interval: string }> = {
  "1d": { range: "1d", interval: "5m" },
  "3d": { range: "1mo", interval: "1d" },
  "7d": { range: "1mo", interval: "1d" },
  "1m": { range: "3mo", interval: "1d" },
  ytd: { range: "ytd", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "5y": { range: "5y", interval: "1d" },
};

interface Series {
  t: number[]; // unix seconds
  c: number[]; // close in native currency
}

async function fetchSeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<Series | null> {
  try {
    const res = await fetchWithTimeout(
      `${YF}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
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
  const { range, interval } = TF_MAP[tf] ?? { range: "1y", interval: "1d" };
  const parsed = parseCsvList(symbolsParam, {
    label: "symbols",
    maxItems: MAX_HISTORY_SYMBOLS,
    maxLength: 32,
    pattern: YAHOO_SYMBOL_RE,
  });
  if (!parsed.ok) {
    return NextResponse.json({ series: {}, error: parsed.error }, { status: 400 });
  }
  if (!parsed.values.length) return NextResponse.json({ series: {} });

  const symbols = parsed.values;
  const results = await Promise.all(
    symbols.map((s) => fetchSeries(s, range, interval)),
  );

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
