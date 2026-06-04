"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/history";
import type { Currency } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useFolio } from "@/lib/store";

export function PerformanceChart({
  data,
  base,
  positive,
  height = 240,
  intraday = false,
}: {
  data: SeriesPoint[];
  base: Currency;
  positive: boolean;
  height?: number;
  intraday?: boolean;
}) {
  const censored = useFolio((s) => s.censored);
  const stroke = positive ? "#34d399" : "#f43f5e";
  const [hoverX, setHoverX] = useState<string | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="grid place-items-center text-sm text-zinc-500"
        style={{ height }}
      >
        Not enough history yet — add trades and check back.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
        onMouseMove={(s: any) =>
          setHoverX(s?.activeLabel ? String(s.activeLabel) : null)
        }
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tickFormatter={(d: string) =>
            intraday ? (d.split("T")[1] ?? d).slice(0, 5) : d.slice(5)
          }
        />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(v: number) => [
            censored ? "*****" : formatMoney(v, base, { compact: true }),
            "Value",
          ]}
        />
        {hoverX && (
          <ReferenceArea
            x1={data[0].date}
            x2={hoverX}
            fill="#a1a1aa"
            fillOpacity={0.1}
            stroke="none"
            ifOverflow="hidden"
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill="url(#perfFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
