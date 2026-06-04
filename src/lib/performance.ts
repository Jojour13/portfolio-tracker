import type { SeriesPoint } from "./history";

export interface ReturnSeries {
  dates: string[];
  /** Daily time-weighted returns (cash flows neutralised). */
  returns: number[];
  /** Cumulative TWR over the window (e.g. 0.18 = +18%). */
  cumulative: number;
  /** Cumulative growth index per day, for charting (0-based). */
  cumSeries: number[];
}

/**
 * Time-Weighted Return: for each day, r = (V_t − F_t)/V_{t−1} − 1 where F_t is
 * the net external cash flow that day. Chaining (1+r) removes the effect of
 * deposits/withdrawals, so the result reflects investment skill, not how much
 * money was added.
 */
export function dailyReturns(points: SeriesPoint[]): ReturnSeries {
  const dates: string[] = [];
  const returns: number[] = [];
  const cumSeries: number[] = [];
  let cum = 1;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].value;
    if (prev <= 0) continue; // no valid base to measure against
    const r = (points[i].value - points[i].flow) / prev - 1;
    if (!Number.isFinite(r)) continue;
    dates.push(points[i].date);
    returns.push(r);
    cum *= 1 + r;
    cumSeries.push(cum - 1);
  }

  return { dates, returns, cumulative: cum - 1, cumSeries };
}
