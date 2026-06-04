import { NextRequest, NextResponse } from "next/server";
import type { Quote } from "@/lib/types";

// CoinGecko free "simple/price" endpoint. We ask for the 24h change so we can
// derive the previous close (price / (1 + change)).
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ quotes: {} });

  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${encodeURIComponent(ids)}` +
    `&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetch(url, {
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
      };
    }
    return NextResponse.json(
      { quotes },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { quotes: {}, error: String(e) },
      { status: 200 },
    );
  }
}
