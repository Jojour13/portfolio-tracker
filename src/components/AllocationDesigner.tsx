"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Check } from "lucide-react";
import { useFolio } from "@/lib/store";
import { Card, Button } from "./ui";
import { formatPercent } from "@/lib/format";

const CLASSES = [
  { key: "crypto", label: "Crypto", color: "#f59e0b" },
  { key: "stock", label: "Stocks", color: "#38bdf8" },
  { key: "cash", label: "Cash", color: "#34d399" },
] as const;

type ClassKey = (typeof CLASSES)[number]["key"];

export function AllocationDesigner() {
  const settings = useFolio((s) => s.settings);
  const updateSettings = useFolio((s) => s.updateSettings);

  const init = settings.targetAllocation;
  const [vals, setVals] = useState<Record<ClassKey, number>>({
    crypto: Math.round((init?.crypto ?? 0.2) * 100),
    stock: Math.round((init?.stock ?? 0.6) * 100),
    cash: Math.round((init?.cash ?? 0.2) * 100),
  });
  const [saved, setSaved] = useState(false);

  const total = vals.crypto + vals.stock + vals.cash || 1;
  const norm = (k: ClassKey) => vals[k] / total;

  const pieData = CLASSES.map((c) => ({
    name: c.label,
    value: vals[c.key],
    color: c.color,
  }));

  function save() {
    updateSettings({
      riskProfile: "custom",
      targetAllocation: {
        crypto: norm("crypto"),
        stock: norm("stock"),
        cash: norm("cash"),
      },
      rebalanceThreshold: settings.rebalanceThreshold ?? 0.07,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-zinc-300">
        Or design your own target
      </h2>
      <p className="mb-4 mt-1 text-xs text-zinc-500">
        Drag to set your ideal mix. The pie updates live; saving makes it your
        rebalance target.
      </p>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full flex-1 space-y-4">
          {CLASSES.map((c) => (
            <div key={c.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label}
                </span>
                <span className="font-medium tabular text-zinc-200">
                  {formatPercent(norm(c.key), 0)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={vals[c.key]}
                onChange={(e) =>
                  setVals((v) => ({ ...v, [c.key]: +e.target.value }))
                }
                className="w-full accent-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      <Button className="mt-5 w-full" onClick={save}>
        {saved ? (
          <>
            <Check size={16} /> Saved as your target
          </>
        ) : (
          "Save as my target allocation"
        )}
      </Button>
    </Card>
  );
}
