import type { Asset } from "./types";
import type { SeriesPoint } from "./history";
import { dailyReturns } from "./performance";

export interface Benchmark {
  key: string;
  symbol: string; // Yahoo symbol
  label: string;
  color: string;
}

/**
 * Pick only the benchmarks relevant to what the user actually holds.
 * e.g. crypto + SGX stocks -> Bitcoin + STI only.
 */
export function relevantBenchmarks(assets: Asset[]): Benchmark[] {
  const out: Benchmark[] = [];
  const has = (pred: (a: Asset) => boolean) => assets.some(pred);

  if (has((a) => a.type === "crypto"))
    out.push({ key: "btc", symbol: "BTC-USD", label: "Bitcoin", color: "#f59e0b" });
  if (has((a) => (a.type === "stock" || a.type === "fund") && a.quoteId.endsWith(".JK")))
    out.push({ key: "ihsg", symbol: "^JKSE", label: "IHSG", color: "#38bdf8" });
  if (has((a) => (a.type === "stock" || a.type === "fund") && a.quoteId.endsWith(".SI")))
    out.push({ key: "sti", symbol: "^STI", label: "STI (SG)", color: "#34d399" });
  if (has((a) => (a.type === "stock" || a.type === "fund") && a.quoteId.endsWith(".SW")))
    out.push({ key: "smi", symbol: "^SSMI", label: "SMI (CH)", color: "#fb7185" });
  if (has((a) => (a.type === "stock" || a.type === "fund") && !a.quoteId.includes(".")))
    out.push({ key: "spx", symbol: "^GSPC", label: "S&P 500", color: "#a78bfa" });
  if (has((a) => a.type === "bond"))
    out.push({ key: "bnd", symbol: "BND", label: "US Total Bond", color: "#c084fc" });

  return out;
}

type RawSeries = Record<string, { t: number[]; c: number[] }>;

export interface ComparisonRow {
  date: string;
  port: number | null;
  [benchKey: string]: number | string | null;
}

export interface ComparisonSummary {
  key: string;
  label: string;
  color: string;
  ret: number; // total return over window
  vsPortfolio: number; // portfolio − benchmark (positive = you won)
}

function ymd(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

/**
 * Build a normalised comparison (everything as % change from the window start).
 * The portfolio line uses Time-Weighted Return so it's a fair, flows-free
 * comparison against each index's price return.
 */
export function buildComparison(
  portfolioWindow: SeriesPoint[],
  benchSeries: RawSeries,
  benchmarks: Benchmark[],
): { data: ComparisonRow[]; summary: ComparisonSummary[]; portReturn: number } {
  const completeWindow = portfolioWindow.filter((p) => !p.partial);
  if (completeWindow.length < 2)
    return { data: [], summary: [], portReturn: 0 };

  const startDate = completeWindow[0].date;
  const ret = dailyReturns(completeWindow);

  // portfolio % (TWR) keyed by date
  const portMap = new Map<string, number>();
  portMap.set(startDate, 0);
  ret.dates.forEach((d, i) => portMap.set(d, ret.cumSeries[i]));
  const portReturn = ret.cumulative;

  // benchmark % keyed by date, normalised to first close in window
  const benchMaps = new Map<string, Map<string, number>>();
  const summary: ComparisonSummary[] = [];

  for (const b of benchmarks) {
    const s = benchSeries[b.symbol];
    const m = new Map<string, number>();
    if (s) {
      let base = 0;
      for (let i = 0; i < s.t.length; i++) {
        const d = ymd(s.t[i]);
        if (d < startDate) continue;
        if (typeof s.c[i] !== "number") continue;
        if (!base) base = s.c[i];
        if (base) m.set(d, s.c[i] / base - 1);
      }
    }
    benchMaps.set(b.key, m);
    const last = [...m.values()].pop() ?? 0;
    summary.push({
      key: b.key,
      label: b.label,
      color: b.color,
      ret: last,
      vsPortfolio: portReturn - last,
    });
  }

  // union date axis, forward-fill each series
  const dates = new Set<string>(portMap.keys());
  for (const m of benchMaps.values()) for (const d of m.keys()) dates.add(d);
  const axis = [...dates].sort();

  const lastVal: Record<string, number> = { port: 0 };
  for (const b of benchmarks) lastVal[b.key] = 0;

  const data: ComparisonRow[] = axis.map((d) => {
    if (portMap.has(d)) lastVal.port = portMap.get(d)!;
    const row: ComparisonRow = { date: d, port: lastVal.port };
    for (const b of benchmarks) {
      const m = benchMaps.get(b.key)!;
      if (m.has(d)) lastVal[b.key] = m.get(d)!;
      row[b.key] = lastVal[b.key];
    }
    return row;
  });

  return { data, summary, portReturn };
}
