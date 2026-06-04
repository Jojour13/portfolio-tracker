// Risk/return metrics from a daily TWR return series.
// Annualisation A = 365 (crypto trades every day; the blended MTM series has no
// market-closed gaps). Sharpe/Sortino are gated behind n >= 30 observations.

const A = 365;

export interface Metrics {
  twr: number; // cumulative time-weighted return
  cagr: number;
  sharpe: number | null;
  sortino: number | null;
  volAnnual: number;
  maxDrawdown: number; // <= 0
  winRate: number;
  best: number;
  worst: number;
  nObs: number;
  /** Whether there are enough observations to trust Sharpe/Sortino. */
  reliable: boolean;
}

export function computeMetrics(
  returns: number[],
  cumulative: number,
  elapsedDays: number,
  rfAnnual: number,
): Metrics {
  const n = returns.length;
  const mean = n ? returns.reduce((a, b) => a + b, 0) / n : 0;
  const variance =
    n > 1 ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const rfDaily = rfAnnual / A;

  const sharpe = sd > 0 ? ((mean - rfDaily) / sd) * Math.sqrt(A) : null;

  const downside = returns.filter((r) => r < 0);
  const dd = downside.length
    ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length)
    : 0;
  const sortino = dd > 0 ? ((mean - rfDaily) / dd) * Math.sqrt(A) : null;

  const volAnnual = sd * Math.sqrt(A);

  const years = elapsedDays / 365;
  const cagr =
    years > 0 && 1 + cumulative > 0
      ? Math.pow(1 + cumulative, 1 / years) - 1
      : cumulative;

  // max drawdown by walking the cumulative growth path
  let peak = 1;
  let val = 1;
  let mdd = 0;
  for (const r of returns) {
    val *= 1 + r;
    if (val > peak) peak = val;
    const draw = val / peak - 1;
    if (draw < mdd) mdd = draw;
  }

  return {
    twr: cumulative,
    cagr,
    sharpe,
    sortino,
    volAnnual,
    maxDrawdown: mdd,
    winRate: n ? returns.filter((r) => r > 0).length / n : 0,
    best: n ? Math.max(...returns) : 0,
    worst: n ? Math.min(...returns) : 0,
    nObs: n,
    reliable: n >= 30,
  };
}

/** A short human label for a Sharpe value. */
export function sharpeLabel(s: number | null): string {
  if (s === null) return "—";
  if (s >= 2) return "excellent";
  if (s >= 1) return "good";
  if (s >= 0) return "modest";
  return "poor";
}
