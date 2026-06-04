"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SeriesPoint } from "@/lib/history";
import type { Currency } from "@/lib/types";
import { dailyMap, aggregate, dailyPnl } from "@/lib/pnlPeriods";
import { useFolio } from "@/lib/store";
import { Card } from "./ui";
import { cn } from "@/lib/utils";

type Mode = "year" | "month" | "day";
const MODES: { k: Mode; label: string }[] = [
  { k: "year", label: "Yearly" },
  { k: "month", label: "Monthly" },
  { k: "day", label: "Daily" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function compact(n: number): string {
  const s = n >= 0 ? "+" : "−";
  const a = Math.abs(n);
  const v =
    a >= 1e9 ? (a / 1e9).toFixed(1) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(1) + "M"
    : a >= 1e3 ? (a / 1e3).toFixed(1) + "K"
    : a.toFixed(0);
  return s + v;
}

/** Tinted background + text color scaled by magnitude. */
function tint(pnl: number, maxAbs: number) {
  if (!pnl || maxAbs === 0)
    return { background: "rgba(63,63,70,0.18)", className: "text-zinc-500" };
  const t = Math.min(1, Math.abs(pnl) / maxAbs);
  const op = 0.14 + 0.5 * t;
  return pnl > 0
    ? { background: `rgba(16,185,129,${op})`, className: "text-emerald-200" }
    : { background: `rgba(244,63,94,${op})`, className: "text-rose-200" };
}

export function PnlGrid({
  points,
  base,
  loading,
}: {
  points: SeriesPoint[];
  base: Currency;
  loading?: boolean;
}) {
  const censored = useFolio((s) => s.censored);
  const [mode, setMode] = useState<Mode>("month");
  const fmt = (n: number) => (censored ? "•••" : compact(n));

  const dMap = useMemo(() => dailyMap(points), [points]);
  const years = useMemo(() => aggregate(dailyPnl(points), "year"), [points]);
  const months = useMemo(() => aggregate(dailyPnl(points), "month"), [points]);

  // available months (YYYY-MM) for the daily calendar
  const monthKeys = useMemo(() => months.map((m) => m.key), [months]);
  const [monthIdx, setMonthIdx] = useState<number | null>(null);
  const activeMonth =
    monthKeys.length === 0
      ? null
      : monthKeys[monthIdx ?? monthKeys.length - 1];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-300">Profit &amp; loss</h2>
          <p className="text-[11px] text-zinc-500">amounts in {base}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-900/60 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.k}
              onClick={() => setMode(m.k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m.k ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
      ) : points.length < 2 ? (
        <div className="py-12 text-center text-sm text-zinc-500">
          Not enough history yet.
        </div>
      ) : mode === "year" ? (
        <YearView years={years} fmt={fmt} />
      ) : mode === "month" ? (
        <MonthView months={months} fmt={fmt} />
      ) : (
        <DayView
          monthKey={activeMonth}
          dMap={dMap}
          monthKeys={monthKeys}
          monthIdx={monthIdx ?? monthKeys.length - 1}
          setMonthIdx={setMonthIdx}
          fmt={fmt}
        />
      )}
    </Card>
  );
}

function Box({
  label,
  pnl,
  maxAbs,
  fmt,
  size = "md",
}: {
  label: string;
  pnl: number | null;
  maxAbs: number;
  fmt: (n: number) => string;
  size?: "sm" | "md" | "lg";
}) {
  const t = pnl === null ? { background: "transparent", className: "text-zinc-700" } : tint(pnl, maxAbs);
  const dims =
    size === "lg" ? "h-20" : size === "sm" ? "h-12" : "h-16";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-white/5 transition-transform hover:scale-[1.04]",
        dims,
      )}
      style={{ background: t.background }}
    >
      <span className="text-[10px] uppercase tracking-wide text-zinc-400/80">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular", t.className)}>
        {pnl === null ? "·" : fmt(pnl)}
      </span>
    </div>
  );
}

function YearView({
  years,
  fmt,
}: {
  years: { key: string; pnl: number }[];
  fmt: (n: number) => string;
}) {
  const maxAbs = Math.max(1, ...years.map((y) => Math.abs(y.pnl)));
  return (
    <div className="flex flex-wrap gap-2.5">
      {years.map((y) => (
        <div key={y.key} className="w-28">
          <Box label={y.key} pnl={y.pnl} maxAbs={maxAbs} fmt={fmt} size="lg" />
        </div>
      ))}
    </div>
  );
}

function MonthView({
  months,
  fmt,
}: {
  months: { key: string; pnl: number }[];
  fmt: (n: number) => string;
}) {
  const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.pnl)));
  const byYear = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const m of months) {
      const y = m.key.slice(0, 4);
      const mo = +m.key.slice(5, 7) - 1;
      if (!map.has(y)) map.set(y, new Map());
      map.get(y)!.set(mo, m.pnl);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [months]);

  return (
    <div className="space-y-3">
      {byYear.map(([year, mm]) => (
        <div key={year} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-semibold text-zinc-400">
            {year}
          </span>
          <div className="grid flex-1 grid-cols-6 gap-1.5 sm:grid-cols-12">
            {MONTHS.map((mname, i) => {
              const pnl = mm.has(i) ? mm.get(i)! : null;
              return (
                <Box
                  key={i}
                  label={mname}
                  pnl={pnl}
                  maxAbs={maxAbs}
                  fmt={fmt}
                  size="sm"
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayView({
  monthKey,
  dMap,
  monthKeys,
  monthIdx,
  setMonthIdx,
  fmt,
}: {
  monthKey: string | null;
  dMap: Map<string, number>;
  monthKeys: string[];
  monthIdx: number;
  setMonthIdx: (i: number) => void;
  fmt: (n: number) => string;
}) {
  if (!monthKey)
    return <div className="py-10 text-center text-sm text-zinc-500">No data.</div>;

  const year = +monthKey.slice(0, 4);
  const month = +monthKey.slice(5, 7) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (first.getUTCDay() + 6) % 7; // Mon=0

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  }

  let monthTotal = 0;
  let maxAbs = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${monthKey}-${String(d).padStart(2, "0")}`;
    if (dMap.has(k)) {
      monthTotal += dMap.get(k)!;
      maxAbs = Math.max(maxAbs, Math.abs(dMap.get(k)!));
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))}
          disabled={monthIdx <= 0}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-white">
            {MONTHS[month]} {year}
          </div>
          <div
            className={cn(
              "text-xs tabular",
              monthTotal >= 0 ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {fmt(monthTotal)}
          </div>
        </div>
        <button
          onClick={() => setMonthIdx(Math.min(monthKeys.length - 1, monthIdx + 1))}
          disabled={monthIdx >= monthKeys.length - 1}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] text-zinc-600">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((k, i) => {
          if (!k) return <div key={i} />;
          const day = +k.slice(8, 10);
          const has = dMap.has(k);
          const pnl = has ? dMap.get(k)! : null;
          const t = has ? tint(pnl!, maxAbs) : { background: "rgba(63,63,70,0.12)", className: "text-zinc-600" };
          return (
            <div
              key={i}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border border-white/5 transition-transform hover:scale-[1.07]"
              style={{ background: t.background }}
              title={has ? `${k}: ${fmt(pnl!)}` : k}
            >
              <span className="text-[9px] text-zinc-500">{day}</span>
              {has && (
                <span className={cn("text-[10px] font-medium leading-none tabular", t.className)}>
                  {fmt(pnl!)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
