import { NextResponse } from "next/server";

// FX rates relative to USD via the free open.er-api.com endpoint
// (no key, includes IDR/SGD/CHF/EUR). rates[c] = units of c per 1 USD.
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`er-api ${res.status}`);
    const data = await res.json();
    const rates = (data?.rates ?? {}) as Record<string, number>;
    return NextResponse.json(
      { base: "USD", rates },
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
      error: String(e),
    });
  }
}
