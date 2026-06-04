"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { useState } from "react";
import type { PortfolioSnapshot, Currency } from "@/lib/types";
import { colorForIndex } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { Money } from "./Money";

interface Props {
  snapshot: PortfolioSnapshot;
  base: Currency;
}

export function AllocationDonut({ snapshot, base }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const data = snapshot.positions.map((p, i) => ({
    name: p.asset.symbol,
    fullName: p.asset.name,
    value: p.marketValueBase ?? 0,
    weight: p.weight,
    color: colorForIndex(i),
  }));

  const focus = active !== null ? data[active] : null;

  return (
    <div className="relative h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={78}
            outerRadius={108}
            paddingAngle={2}
            stroke="none"
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(null)}
            activeIndex={active ?? undefined}
            activeShape={(props: any) => (
              <Sector {...props} outerRadius={props.outerRadius + 6} />
            )}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {focus ? (
          <>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {focus.fullName}
            </span>
            <span className="text-2xl font-semibold text-white tabular">
              {formatPercent(focus.weight, 1)}
            </span>
            <Money
              value={focus.value}
              currency={base}
              compact
              className="text-sm text-zinc-400 tabular"
            />
          </>
        ) : (
          <>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Total value
            </span>
            <Money
              value={snapshot.totalValueBase}
              currency={base}
              compact
              className="text-2xl font-semibold text-white tabular"
            />
            <span className="text-sm text-zinc-400">
              {data.length} holdings
            </span>
          </>
        )}
      </div>
    </div>
  );
}
