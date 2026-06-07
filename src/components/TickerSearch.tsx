"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";
import { ASSET_TYPE_LABEL, type SearchableAssetType } from "@/lib/types";
import { Input } from "./ui";

const PLACEHOLDER: Record<SearchableAssetType, string> = {
  crypto: "Search coin (e.g. bitcoin, sol)...",
  stock: "Search ticker (e.g. AAPL, BBCA, DBS)...",
  fund: "Search fund or ETF (e.g. VOO, IWDA)...",
  bond: "Search bond fund (e.g. BND, AGG)...",
  money_market: "Search money market fund (e.g. SGOV, BIL)...",
};

export function TickerSearch({
  type,
  onSelect,
  onQueryChange,
}: {
  type: SearchableAssetType;
  onSelect: (r: SearchResult) => void;
  onQueryChange?: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ("");
    setResults([]);
    setOpen(false);
  }, [type]);

  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=${type}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, type]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <Input
          className="pl-9"
          placeholder={PLACEHOLDER[type]}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onQueryChange?.();
          }}
          onFocus={() => results.length && setOpen(true)}
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500"
          />
        )}
      </div>

      {open && q.trim().length > 0 && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 shadow-2xl shadow-black/40">
          No supported {ASSET_TYPE_LABEL[type].toLowerCase()} ticker found.
          Folio currently values Yahoo-listed USD, IDR, SGD, CHF, and EUR
          instruments. Options are intentionally excluded.
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl shadow-black/40">
          {results.map((r) => (
            <button
              key={`${r.quoteSource}-${r.quoteId}`}
              type="button"
              onClick={() => {
                onSelect(r);
                setQ(`${r.symbol} - ${r.name}`);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-800"
            >
              <div className="min-w-0">
                <div className="font-medium text-zinc-100">{r.symbol}</div>
                <div className="truncate text-xs text-zinc-500">{r.name}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-zinc-500">
                <div>{r.exchange}</div>
                <div>{r.currency}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
