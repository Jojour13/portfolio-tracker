"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Benchmark, ComparisonRow, ComparisonSummary } from "@/lib/benchmark";
import { Card } from "./ui";
import { formatPercent, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BenchmarkChart({
  data,
  benchmarks,
  summary,
  portReturn,
  loading,
}: {
  data: ComparisonRow[];
  benchmarks: Benchmark[];
  summary: ComparisonSummary[];
  portReturn: number;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">vs Benchmarks</h2>
        <span className="text-[11px] text-zinc-500">
          % return over the selected window
        </span>
      </div>

      {loading ? (
        <div className="grid h-[240px] place-items-center text-sm text-zinc-500">
          Loading…
        </div>
      ) : data.length < 2 || benchmarks.length === 0 ? (
        <div className="grid h-[200px] place-items-center text-sm text-zinc-500">
          Not enough data to compare yet.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(v: number, name: string) => [
                  formatPercent(v),
                  name,
                ]}
              />
              <Line
                type="monotone"
                dataKey="port"
                name="Portfolio"
                stroke="#fafafa"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              {benchmarks.map((b) => (
                <Line
                  key={b.key}
                  type="monotone"
                  dataKey={b.key}
                  name={b.label}
                  stroke={b.color}
                  strokeWidth={1.75}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* summary chips: you vs each benchmark */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-zinc-100" /> Portfolio
              </div>
              <div className={cn("text-base font-semibold tabular", pnlColor(portReturn))}>
                {formatPercent(portReturn)}
              </div>
            </div>
            {summary.map((s) => (
              <div
                key={s.key}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("text-base font-semibold tabular", pnlColor(s.ret))}>
                    {formatPercent(s.ret)}
                  </span>
                  <span className={cn("text-[11px] tabular", pnlColor(s.vsPortfolio))}>
                    {s.vsPortfolio >= 0 ? "you +" : "you "}
                    {formatPercent(s.vsPortfolio).replace("+", "")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
