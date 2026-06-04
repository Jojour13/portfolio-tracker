"use client";

import { useFolio } from "@/lib/store";
import { ModelBuilder } from "@/components/ModelBuilder";

export default function DesignPage() {
  const hydrated = useFolio((s) => s.hydrated);
  if (!hydrated)
    return <div className="py-20 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="animate-fade space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Design a portfolio
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plan your ideal mix with live prices — choose exact tickers, coins and
          cash. It never affects your real holdings.
        </p>
      </div>
      <ModelBuilder />
    </div>
  );
}
