"use client";

import { forwardRef } from "react";
import type { Currency } from "@/lib/types";
import { Bull } from "./mascots/Bull";
import { Bear } from "./mascots/Bear";
import { formatMoney, formatPercent } from "@/lib/format";

export interface ShareCardProps {
  tfLabel: string;
  twr: number;
  absChange: number | null;
  base: Currency;
  sharpe: number | null;
  reliable: boolean;
  maxDrawdown: number;
  message: string;
  leveraged: boolean;
  shortWindow: boolean;
  censored: boolean;
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard(p, ref) {
    const positive = p.twr >= 0;
    const accent = positive ? "#34d399" : "#f43f5e";

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(99,102,241,0.18), transparent 60%), #09090b",
          border: "1px solid #27272a",
        }}
        className="overflow-hidden rounded-3xl px-6 pb-5 pt-6 text-center"
      >
        {/* brand */}
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-400 text-sm font-bold text-white">
            ƒ
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Folio
          </span>
        </div>

        {/* mascot */}
        <div className="flex justify-center">
          {positive ? <Bull size={150} /> : <Bear size={150} />}
        </div>

        {/* headline return */}
        <div className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
          {p.tfLabel} return
        </div>
        <div
          className="text-5xl font-extrabold tabular"
          style={{ color: accent }}
        >
          {formatPercent(p.twr)}
        </div>

        {/* absolute (hidden when censored) */}
        <div className="mt-1 text-sm text-zinc-400 tabular">
          {p.censored || p.absChange === null
            ? "***** "
            : formatMoney(p.absChange, p.base, { compact: true })}
          <span className="text-zinc-600"> change</span>
        </div>

        {/* tags */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {p.reliable && p.sharpe !== null && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              Sharpe {p.sharpe.toFixed(2)}
            </span>
          )}
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
            Max DD {formatPercent(p.maxDrawdown, 0)}
          </span>
          {p.leveraged && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              leveraged
            </span>
          )}
          {p.shortWindow && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
              short window — noise, not skill
            </span>
          )}
        </div>

        {/* message */}
        <div
          className="mx-auto mt-4 max-w-[280px] text-[13px] leading-snug"
          style={{ color: positive ? "#a7f3d0" : "#fecdd3" }}
        >
          “{p.message}”
        </div>

        {/* fine print */}
        <div className="mt-4 border-t border-zinc-800 pt-2.5 text-[10px] leading-tight text-zinc-600">
          Past performance ≠ future results. Not financial advice.
          <br />
          Returns are time-weighted (deposits/withdrawals excluded).
        </div>
      </div>
    );
  },
);
