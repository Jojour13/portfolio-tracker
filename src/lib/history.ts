import type { Asset, Currency, Transaction } from "./types";
import { convertOrNull } from "./portfolio";
import { cashFlowTypeForTransaction, isExternalCashFlow } from "./cashFlow";

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // portfolio MTM value in base currency
  /** Net external cash flow that day (deposits/buys +, withdrawals/sells −), base ccy. */
  flow: number;
  /** True when one or more held assets could not be valued on this point. */
  partial?: boolean;
  /** Count of held positions missing price coverage on this point. */
  missingPrices?: number;
  /** Count of held positions or flows missing FX conversion on this point. */
  missingConversions?: number;
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
    let missingConversions = 0;
    const todays = txByDate.get(d) ?? [];
    for (const t of todays) {
      const a = assetById.get(t.assetId);
      if (!a) continue;
      const signedQty = t.side === "buy" ? t.quantity : -t.quantity;
      qty.set(t.assetId, (qty.get(t.assetId) ?? 0) + signedQty);
      const cashFlowType = cashFlowTypeForTransaction(a, t);
      if (a.type === "cash" && !isExternalCashFlow(cashFlowType)) {
        continue;
      }
      const cashMoved =
        t.side === "buy"
          ? t.quantity * t.price + t.fee
          : -(t.quantity * t.price - t.fee);
      const convertedFlow = convertOrNull(
        cashMoved,
        a.currency,
        base,
        ratesPerUsd,
      );
      if (convertedFlow === null) missingConversions += 1;
      else flow += convertedFlow;
    }

    let value = 0;
    let missingPrices = 0;
    for (const a of assets) {
      const q = qty.get(a.id) ?? 0;
      if (q === 0) continue;
      const price = a.type === "cash" ? 1 : filled.get(a.id)!.get(d) ?? 0;
      if (a.type !== "cash" && price <= 0) {
        missingPrices += 1;
        continue;
      }
      const convertedValue = convertOrNull(
        q * price,
        a.currency,
        base,
        ratesPerUsd,
      );
      if (convertedValue === null) missingConversions += 1;
      else value += convertedValue;
    }

    points.push({
      date: d,
      value,
      flow,
      partial: missingPrices > 0 || missingConversions > 0,
      missingPrices,
      missingConversions,
    });
  }

  return points;
}

/**
 * Intraday value series for the 1D view. Holdings are treated as constant
 * through the day (intraday trades are rare), so value at each 5-min bar is
 * just current quantity marked to that bar's price. Keys are minute-resolution.
 */
export function reconstructIntraday(
  assets: Asset[],
  transactions: Transaction[],
  series: Record<string, { t: number[]; c: number[] }>,
  ratesPerUsd: Record<string, number>,
  base: Currency,
): SeriesPoint[] {
  // current net quantity per asset
  const qty = new Map<string, number>();
  for (const t of transactions) {
    const q = qty.get(t.assetId) ?? 0;
    qty.set(t.assetId, q + (t.side === "buy" ? t.quantity : -t.quantity));
  }

  // union minute axis + per-asset close maps
  const axis = new Set<string>();
  const closeByAsset = new Map<string, Map<string, number>>();
  for (const a of assets) {
    const s = series[a.quoteId];
    const m = new Map<string, number>();
    if (a.type !== "cash" && s) {
      for (let i = 0; i < s.t.length; i++) {
        const k = new Date(s.t[i] * 1000).toISOString().slice(0, 16);
        m.set(k, s.c[i]);
        axis.add(k);
      }
    }
    closeByAsset.set(a.id, m);
  }

  const keys = [...axis].sort();
  if (!keys.length) return [];

  const last = new Map<string, number>();
  const points: SeriesPoint[] = [];
  for (const k of keys) {
    let value = 0;
    let missingPrices = 0;
    let missingConversions = 0;
    for (const a of assets) {
      const q = qty.get(a.id) ?? 0;
      if (q === 0) continue;
      let price: number;
      if (a.type === "cash") price = 1;
      else {
        const m = closeByAsset.get(a.id)!;
        if (m.has(k)) last.set(a.id, m.get(k)!);
        price = last.get(a.id) ?? 0;
      }
      if (a.type !== "cash" && price <= 0) {
        missingPrices += 1;
        continue;
      }
      const convertedValue = convertOrNull(
        q * price,
        a.currency,
        base,
        ratesPerUsd,
      );
      if (convertedValue === null) missingConversions += 1;
      else value += convertedValue;
    }
    points.push({
      date: k,
      value,
      flow: 0,
      partial: missingPrices > 0 || missingConversions > 0,
      missingPrices,
      missingConversions,
    });
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
