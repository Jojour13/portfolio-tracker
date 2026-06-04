import type { Asset, Currency, Transaction } from "./types";
import { convert } from "./portfolio";

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // portfolio MTM value in base currency
  /** Net external cash flow that day (deposits/buys +, withdrawals/sells −), base ccy. */
  flow: number;
}

type RawSeries = Record<string, { t: number[]; c: number[] }>;

function ymd(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

/**
 * Reconstruct the daily portfolio value (and external flows) over time.
 *
 * NOTE: historical FX is approximated with the CURRENT rate table — this keeps
 * the chart focused on asset performance and avoids a flaky free FX-history
 * feed. Native-currency values are exact; cross-currency blending uses today's
 * FX. (A `price_snapshots` upgrade can add true historical FX later.)
 */
export function reconstructTimeSeries(
  assets: Asset[],
  transactions: Transaction[],
  series: RawSeries,
  ratesPerUsd: Record<string, number>,
  base: Currency,
): SeriesPoint[] {
  const assetById = new Map(assets.map((a) => [a.id, a]));

  // 1) date -> close map per asset (by quoteId), and the global date axis
  const axis = new Set<string>();
  const closeByAsset = new Map<string, Map<string, number>>();

  for (const a of assets) {
    const s = series[a.quoteId];
    const m = new Map<string, number>();
    if (a.type === "cash") {
      // cash has no price series; handled as constant 1 at value time
    } else if (s) {
      for (let i = 0; i < s.t.length; i++) {
        const d = ymd(s.t[i]);
        m.set(d, s.c[i]);
        axis.add(d);
      }
    }
    closeByAsset.set(a.id, m);
  }

  // include transaction dates and today so flows are never dropped
  for (const t of transactions) axis.add(t.date);
  axis.add(new Date().toISOString().slice(0, 10));

  const dates = [...axis].sort();
  if (!dates.length) return [];

  // 2) forward-fill closes per asset along the axis
  const filled = new Map<string, Map<string, number>>();
  for (const a of assets) {
    const src = closeByAsset.get(a.id)!;
    const out = new Map<string, number>();
    let last = 0;
    for (const d of dates) {
      if (src.has(d)) last = src.get(d)!;
      out.set(d, last);
    }
    filled.set(a.id, out);
  }

  // 3) group transactions by date for quantity replay + flow
  const txByDate = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = txByDate.get(t.date) ?? [];
    list.push(t);
    txByDate.set(t.date, list);
  }

  const qty = new Map<string, number>(); // running quantity per assetId
  const points: SeriesPoint[] = [];

  for (const d of dates) {
    let flow = 0;
    const todays = txByDate.get(d) ?? [];
    for (const t of todays) {
      const a = assetById.get(t.assetId);
      if (!a) continue;
      const signedQty = t.side === "buy" ? t.quantity : -t.quantity;
      qty.set(t.assetId, (qty.get(t.assetId) ?? 0) + signedQty);
      const cashMoved =
        t.side === "buy"
          ? t.quantity * t.price + t.fee
          : -(t.quantity * t.price - t.fee);
      flow += convert(cashMoved, a.currency, base, ratesPerUsd);
    }

    let value = 0;
    for (const a of assets) {
      const q = qty.get(a.id) ?? 0;
      if (q === 0) continue;
      const price = a.type === "cash" ? 1 : filled.get(a.id)!.get(d) ?? 0;
      value += convert(q * price, a.currency, base, ratesPerUsd);
    }

    points.push({ date: d, value, flow });
  }

  return points;
}

/** Slice the series to a trailing window (days) or 'ytd'/'all'. */
export function sliceWindow(points: SeriesPoint[], tf: string): SeriesPoint[] {
  if (!points.length) return points;
  if (tf === "5y" || tf === "all") return points;
  const last = points[points.length - 1].date;
  let cutoff: string;
  if (tf === "ytd") {
    cutoff = last.slice(0, 4) + "-01-01";
  } else {
    const days = tf === "3d" ? 3 : tf === "7d" ? 7 : tf === "1y" ? 365 : 30;
    const dt = new Date(last + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() - days);
    cutoff = dt.toISOString().slice(0, 10);
  }
  return points.filter((p) => p.date >= cutoff);
}
