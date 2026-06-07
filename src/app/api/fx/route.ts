import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/apiGuards";

// FX rates relative to USD via the free open.er-api.com endpoint
// (no key, includes IDR/SGD/CHF/EUR). rates[c] = units of c per 1 USD.
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`er-api ${res.status}`);
    const data = await res.json();
    const rates = (data?.rates ?? {}) as Record<string, number>;
    const asOf =
      typeof data?.time_last_update_unix === "number"
        ? new Date(data.time_last_update_unix * 1000).toISOString()
        : undefined;
    return NextResponse.json(
      {
        base: "USD",
        rates,
        provider: "open.er-api.com",
        asOf,
        fallback: false,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (e) {
    // Fallback to a static, approximate table so the app still renders.
    return NextResponse.json({
      base: "USD",
      rates: { USD: 1, IDR: 16300, SGD: 1.35, CHF: 0.9, EUR: 0.92 },
      provider: "static fallback",
      asOf: null,
      fallback: true,
      error: String(e),
    });
  }
}
