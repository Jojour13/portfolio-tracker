"use client";

import { useFolio } from "@/lib/store";
import { ModelBuilder } from "@/components/ModelBuilder";
import { RiskQuiz } from "@/components/RiskQuiz";
import { AllocationDesigner } from "@/components/AllocationDesigner";

export default function DesignPage() {
  const hydrated = useFolio((s) => s.hydrated);
  if (!hydrated)
    return <div className="py-20 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="animate-fade space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Design a portfolio
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plan your ideal mix with live prices across crypto, equities, funds,
          fixed income, money market, and cash. It never affects your real
          holdings.
        </p>
      </div>
      <ModelBuilder />
      <RiskQuiz />
      <AllocationDesigner />
    </div>
  );
}
