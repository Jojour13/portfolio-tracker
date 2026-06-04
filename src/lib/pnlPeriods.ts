import type { SeriesPoint } from "./history";

export interface PeriodPnl {
  key: string;
  label: string;
  pnl: number;
}

export type Grouping = "day" | "week" | "month";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dayLabel(d: string): string {
  return `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(8, 10)}`;
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Daily P/L = (V_t − V_{t−1}) − external flow on day t. */
export function dailyPnl(points: SeriesPoint[]): PeriodPnl[] {
  const out: PeriodPnl[] = [];
  for (let i = 1; i < points.length; i++) {
    const pnl = points[i].value - points[i - 1].value - points[i].flow;
    out.push({ key: points[i].date, label: dayLabel(points[i].date), pnl });
  }
  return out;
}

export function aggregate(daily: PeriodPnl[], by: Grouping): PeriodPnl[] {
  if (by === "day") return daily;
  const sums = new Map<string, number>();
  for (const d of daily) {
    const key = by === "month" ? d.key.slice(0, 7) : weekStart(d.key);
    sums.set(key, (sums.get(key) ?? 0) + d.pnl);
  }
  return [...sums.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, pnl]) => ({
      key,
      label:
        by === "month"
          ? `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`
          : `Wk ${dayLabel(key)}`,
      pnl,
    }));
}

/** Convenience: build the grouped series straight from points. */
export function periodPnl(points: SeriesPoint[], by: Grouping): PeriodPnl[] {
  return aggregate(dailyPnl(points), by);
}
