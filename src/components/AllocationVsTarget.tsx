"use client";

import Link from "next/link";
import { AlertTriangle, Check, SlidersHorizontal } from "lucide-react";
import type { TargetAllocation, ValuedPosition } from "@/lib/types";
import { currentAllocation, computeDrift, maxDrift } from "@/lib/risk";
import { Card, Button } from "./ui";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const CLASS_LABEL = { crypto: "Crypto", stock: "Stocks", cash: "Cash" } as const;
const CLASS_COLOR = {
  crypto: "bg-amber-400",
  stock: "bg-sky-400",
  cash: "bg-emerald-400",
} as const;

export function AllocationVsTarget({
  positions,
  target,
  threshold = 0.07,
}: {
  positions: ValuedPosition[];
  target?: TargetAllocation;
  threshold?: number;
}) {
  if (!target) {
    return (
      <Card className="flex flex-col items-center gap-2 p-5 text-center">
        <SlidersHorizontal className="text-zinc-500" size={20} />
        <h2 className="text-sm font-medium text-zinc-200">
          Set your target allocation
        </h2>
        <p className="max-w-xs text-xs text-zinc-500">
          Answer a 5-question risk quiz and Folio will suggest your ideal mix —
          then flag when your portfolio drifts off target.
        </p>
        <Link href="/settings#risk">
          <Button size="sm" variant="outline">
            Find my risk profile
          </Button>
        </Link>
      </Card>
    );
  }

  const current = currentAllocation(positions);
  const drifts = computeDrift(current, target);
  const worst = maxDrift(drifts);
  const offTarget = worst > threshold;
  const lead = [...drifts].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">Target allocation</h2>
        <Link
          href="/settings#risk"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Adjust
        </Link>
      </div>

      <div className="space-y-3">
        {drifts.map((d) => (
          <div key={d.cls}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-zinc-300">{CLASS_LABEL[d.cls]}</span>
              <span className="text-zinc-500 tabular">
                {formatPercent(d.current, 0)} / target{" "}
                {formatPercent(d.target, 0)}
              </span>
            </div>
            {/* track with target marker */}
            <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn("h-full rounded-full", CLASS_COLOR[d.cls])}
                style={{ width: `${Math.min(100, d.current * 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-white/70"
                style={{ left: `${Math.min(100, d.target * 100)}%` }}
                title="target"
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs",
          offTarget
            ? "bg-amber-500/10 text-amber-300"
            : "bg-emerald-500/10 text-emerald-300",
        )}
      >
        {offTarget ? (
          <>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Off balance — <b>{CLASS_LABEL[lead.cls]}</b> is{" "}
              {lead.diff > 0 ? "over" : "under"} target by{" "}
              {formatPercent(Math.abs(lead.diff), 0)}.{" "}
              {lead.diff > 0 ? "Consider trimming" : "Consider adding"}.
            </span>
          </>
        ) : (
          <>
            <Check size={14} className="mt-0.5 shrink-0" />
            <span>On target — within {formatPercent(threshold, 0)} of your plan.</span>
          </>
        )}
      </div>
    </Card>
  );
}
