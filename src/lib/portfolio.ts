import type {
  Asset,
  Currency,
  PortfolioSnapshot,
  Position,
  Quote,
  Transaction,
  ValuedPosition,
} from "./types";

/**
 * Reduce an asset's transactions (chronological) into a single position using
 * the weighted-average-cost method.
 *
 *  - BUY  -> avgCost moves toward the buy price, weighted by quantity.
 *            Fees are capitalised into the cost basis.
 *  - SELL -> quantity drops, avgCost is unchanged, realised P/L is booked
 *            against the current avgCost. Fees reduce the proceeds.
 */
export function buildPosition(asset: Asset, txns: Transaction[]): Position {
  const ordered = [...txns].sort((a, b) => a.date.localeCompare(b.date));

  let quantity = 0;
  let avgCost = 0;
  let realizedPnl = 0;
  // Margin accounting: split each buy's notional into own equity + borrowed.
  // Leverage never changes the cost basis (avgCost) — only how it was funded.
  let equity = 0;
  let borrowed = 0;

  for (const t of ordered) {
    if (t.side === "buy") {
      const newQty = quantity + t.quantity;
      const notional = t.quantity * t.price + t.fee;
      const lev = t.margin && t.leverage && t.leverage > 1 ? t.leverage : 1;
      equity += notional / lev;
      borrowed += notional - notional / lev;
      const newCostBasis = quantity * avgCost + notional;
      avgCost = newQty > 0 ? newCostBasis / newQty : 0;
      quantity = newQty;
    } else {
      // sell — reduce funding proportionally to the fraction sold
      const sellQty = Math.min(t.quantity, quantity);
      const proceeds = sellQty * t.price - t.fee;
      realizedPnl += proceeds - sellQty * avgCost;
      const remainFrac = quantity > 0 ? (quantity - sellQty) / quantity : 0;
      equity *= remainFrac;
      borrowed *= remainFrac;
      quantity -= sellQty;
      if (quantity <= 1e-12) {
        quantity = 0;
        avgCost = 0;
        equity = 0;
        borrowed = 0;
      }
    }
  }

  const invested = quantity * avgCost;
  const leverage = equity > 0 ? (equity + borrowed) / equity : 1;

  return {
    asset,
    quantity,
    avgCost,
    invested,
    realizedPnl,
    leverage,
    equityInvested: equity > 0 ? equity : invested,
    borrowed: borrowed > 0 ? borrowed : 0,
  };
}

/** Group transactions by asset and build every position. */
export function buildPositions(
  assets: Asset[],
  transactions: Transaction[],
): Position[] {
  const byAsset = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byAsset.get(t.assetId) ?? [];
    list.push(t);
    byAsset.set(t.assetId, list);
  }
  return assets.map((a) => buildPosition(a, byAsset.get(a.id) ?? []));
}

/**
 * Convert an amount from one currency to another using a USD-based rate table
 * (rates[c] = how many units of c per 1 USD).
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  ratesPerUsd: Record<string, number>,
): number {
  if (from === to) return amount;
  const fromRate = from === "USD" ? 1 : ratesPerUsd[from];
  const toRate = to === "USD" ? 1 : ratesPerUsd[to];
  if (!fromRate || !toRate) return amount; // graceful fallback
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

/** Combine positions, live quotes and FX into a fully-valued snapshot. */
export function valuePortfolio(
  positions: Position[],
  quotes: Record<string, Quote>,
  ratesPerUsd: Record<string, number>,
  base: Currency,
): PortfolioSnapshot {
  const valued: ValuedPosition[] = positions.map((p) => {
    const isCash = p.asset.type === "cash";
    const quote = quotes[p.asset.quoteId];
    const price = isCash ? 1 : quote?.price ?? null;
    const prevClose = isCash ? 1 : quote?.prevClose ?? null;

    const marketValueNative = price !== null ? p.quantity * price : null;
    const marketValueBase =
      marketValueNative !== null
        ? convert(marketValueNative, p.asset.currency, base, ratesPerUsd)
        : null;
    const investedBase = convert(p.invested, p.asset.currency, base, ratesPerUsd);

    const unrealizedPnlNative =
      marketValueNative !== null ? marketValueNative - p.invested : null;
    const unrealizedPnlPct =
      unrealizedPnlNative !== null && p.invested > 0
        ? unrealizedPnlNative / p.invested
        : null;
    const dayChangePct =
      price !== null && prevClose && prevClose > 0
        ? price / prevClose - 1
        : null;

    // Leverage: liquidation price for a long ~ avgCost * (1 - 1/leverage),
    // and the return felt on own capital is amplified by the leverage.
    const levered = p.leverage > 1.0001;
    const liqPrice = levered ? p.avgCost * (1 - 1 / p.leverage) : null;
    const distanceToLiqPct =
      levered && price !== null && price > 0 && liqPrice !== null
        ? (price - liqPrice) / price
        : null;
    const pnlPctOnEquity =
      unrealizedPnlPct !== null ? unrealizedPnlPct * p.leverage : null;

    return {
      ...p,
      price,
      prevClose,
      marketValueNative,
      marketValueBase,
      investedBase,
      unrealizedPnlNative,
      unrealizedPnlPct,
      pnlPctOnEquity,
      dayChangePct,
      liqPrice,
      distanceToLiqPct,
      weight: 0,
    };
  });

  const totalValueBase = valued.reduce(
    (s, v) => s + (v.marketValueBase ?? 0),
    0,
  );
  const totalInvestedBase = valued.reduce((s, v) => s + v.investedBase, 0);

  // day change in base currency: value moved since previous close
  let dayChangeBase = 0;
  for (const v of valued) {
    if (
      v.marketValueBase !== null &&
      v.dayChangePct !== null &&
      v.asset.type !== "cash"
    ) {
      const prevValue = v.marketValueBase / (1 + v.dayChangePct);
      dayChangeBase += v.marketValueBase - prevValue;
    }
  }

  for (const v of valued) {
    v.weight =
      totalValueBase > 0 ? (v.marketValueBase ?? 0) / totalValueBase : 0;
  }
  valued.sort((a, b) => (b.marketValueBase ?? 0) - (a.marketValueBase ?? 0));

  const totalUnrealizedPnlBase = totalValueBase - totalInvestedBase;

  return {
    positions: valued,
    totalValueBase,
    totalInvestedBase,
    totalUnrealizedPnlBase,
    totalUnrealizedPnlPct:
      totalInvestedBase > 0 ? totalUnrealizedPnlBase / totalInvestedBase : 0,
    dayChangeBase,
    dayChangePct:
      totalValueBase - dayChangeBase > 0
        ? dayChangeBase / (totalValueBase - dayChangeBase)
        : 0,
  };
}
