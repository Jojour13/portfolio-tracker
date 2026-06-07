"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  History as HistoryIcon,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useFolio } from "@/lib/store";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationDonut } from "@/components/AllocationDonut";
import { AllocationVsTarget } from "@/components/AllocationVsTarget";
import { HoldingsTable } from "@/components/HoldingsTable";
import { PnlGrid } from "@/components/PnlGrid";
import { useHistory } from "@/hooks/useHistory";
import { Card, Button } from "@/components/ui";
import { cn, colorForIndex } from "@/lib/utils";
import { pickMessage } from "@/lib/messages";

const DEMO_TRANSACTION_IDS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];

export default function DashboardPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const censored = useFolio((s) => s.censored);
  const toggleCensor = useFolio((s) => s.toggleCensor);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const settings = useFolio((s) => s.settings);
  const clearAll = useFolio((s) => s.clearAll);
  const {
    snapshot,
    base,
    ratesPerUsd,
    fxFallback,
    fxAsOf,
    isFetching,
    lastUpdated,
    refetch,
    hasOpenPositions,
    hasActivity,
  } = usePortfolio();
  const {
    points,
    isLoading: histLoading,
    isError: histError,
    refetch: refetchHistory,
  } = useHistory(assets, transactions, ratesPerUsd, base);

  const [ago, setAgo] = useState("");
  const demoPortfolio = useMemo(
    () =>
      transactions.length === DEMO_TRANSACTION_IDS.length &&
      DEMO_TRANSACTION_IDS.every((id) =>
        transactions.some((t) => t.id === id),
      ),
    [transactions],
  );
  useEffect(() => {
    const tick = () => {
      if (!lastUpdated) return setAgo("");
      const s = Math.round((Date.now() - lastUpdated) / 1000);
      setAgo(s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  if (!hydrated) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="animate-fade space-y-5">
      {/* header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Portfolio
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                isFetching ? "animate-pulse bg-amber-400" : "bg-emerald-400",
              )}
            />
            {isFetching
              ? "Refreshing prices..."
              : `Indicative prices - refreshed ${ago || "not yet"}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCensor}
            title={censored ? "Show amounts" : "Hide amounts"}
            aria-label={censored ? "Show amounts" : "Hide amounts"}
          >
            {censored ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/add">
            <Button size="sm">
              <PlusCircle size={14} /> Add
            </Button>
          </Link>
        </div>
      </div>

      {demoPortfolio && <DemoBanner onClear={clearAll} />}

      {!hasActivity ? (
        <EmptyState />
      ) : (
        <>
          <SummaryCards snapshot={snapshot} base={base} />

          <PortfolioGuidance
            unpricedCount={snapshot.unpricedPositionCount}
            unconvertedPositionCount={snapshot.unconvertedPositionCount}
            unconvertedRealizedPnlCount={snapshot.unconvertedRealizedPnlCount}
            unconvertedIncomeCount={snapshot.unconvertedIncomeCount}
            unconvertedWithholdingTaxCount={
              snapshot.unconvertedWithholdingTaxCount
            }
            fxFallback={fxFallback}
            fxAsOf={fxAsOf}
            base={base}
            hasTarget={!!settings.targetAllocation}
            transactionsCount={transactions.length}
            refreshedLabel={ago}
          />

          {histError && (
            <DataWarning
              title="Historical P/L could not refresh"
              body="Live holdings still render, but calendar P/L and performance history may be stale or incomplete."
              action="Retry history"
              onAction={() => void refetchHistory()}
            />
          )}

          {hasOpenPositions ? (
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <div className="space-y-5">
                <Card className="p-5">
                  <h2 className="mb-1 text-sm font-medium text-zinc-300">
                    Allocation
                  </h2>
                  <AllocationDonut snapshot={snapshot} base={base} />
                  <div className="mt-3 space-y-1.5">
                    {snapshot.positions.slice(0, 6).map((p, i) => (
                      <Legend
                        key={p.asset.id}
                        i={i}
                        label={p.asset.symbol}
                        weight={p.weight}
                      />
                    ))}
                  </div>
                </Card>

                <AllocationVsTarget
                  positions={snapshot.positions}
                  target={settings.targetAllocation}
                  base={base}
                  threshold={settings.rebalanceThreshold ?? 0.07}
                  valuationIncomplete={snapshot.valuationIncomplete}
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-medium text-zinc-300">Holdings</h2>
                <HoldingsTable positions={snapshot.positions} base={base} />
              </div>
            </div>
          ) : (
            <ClosedPortfolioPanel />
          )}

          <PnlGrid points={points} base={base} loading={histLoading} />

          <MessageBanner
            profit={
              hasOpenPositions
                ? snapshot.totalUnrealizedPnlBase >= 0
                : snapshot.totalRealizedBase + snapshot.totalIncomeBase >= 0
            }
            incomplete={snapshot.valuationIncomplete}
            closed={!hasOpenPositions}
          />
        </>
      )}
    </div>
  );
}

function DataWarning({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">{title}</div>
          <p className="text-xs text-amber-100/75">{body}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onAction}>
        <RefreshCw size={14} /> {action}
      </Button>
    </div>
  );
}

function DemoBanner({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium">Demo portfolio loaded</div>
        <p className="text-xs text-amber-100/75">
          These sample holdings are for orientation. Clear them before entering
          real transactions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/add">
          <Button size="sm" variant="outline">
            <PlusCircle size={14} /> Add my data
          </Button>
        </Link>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (
              confirm(
                "Clear the demo holdings, transactions, and model portfolio? If cloud sync is connected, remote rows are cleared too.",
              )
            )
              onClear();
          }}
        >
          Clear demo
        </Button>
      </div>
    </div>
  );
}

function PortfolioGuidance({
  unpricedCount,
  unconvertedPositionCount,
  unconvertedRealizedPnlCount,
  unconvertedIncomeCount,
  unconvertedWithholdingTaxCount,
  fxFallback,
  fxAsOf,
  base,
  hasTarget,
  transactionsCount,
  refreshedLabel,
}: {
  unpricedCount: number;
  unconvertedPositionCount: number;
  unconvertedRealizedPnlCount: number;
  unconvertedIncomeCount: number;
  unconvertedWithholdingTaxCount: number;
  fxFallback: boolean;
  fxAsOf: string | null;
  base: string;
  hasTarget: boolean;
  transactionsCount: number;
  refreshedLabel: string;
}) {
  const hasMissingFx =
    unconvertedPositionCount > 0 ||
    unconvertedRealizedPnlCount > 0 ||
    unconvertedIncomeCount > 0 ||
    unconvertedWithholdingTaxCount > 0;
  const hasDataIssue = unpricedCount > 0 || hasMissingFx || fxFallback;
  const missingFxLabel = [
    unconvertedPositionCount > 0
      ? `${unconvertedPositionCount} open holding${unconvertedPositionCount === 1 ? "" : "s"}`
      : "",
    unconvertedRealizedPnlCount > 0
      ? `realized P/L from ${unconvertedRealizedPnlCount} asset${unconvertedRealizedPnlCount === 1 ? "" : "s"}`
      : "",
    unconvertedIncomeCount > 0
      ? `${unconvertedIncomeCount} income row${unconvertedIncomeCount === 1 ? "" : "s"}`
      : "",
    unconvertedWithholdingTaxCount > 0
      ? `withholding tax from ${unconvertedWithholdingTaxCount} income row${unconvertedWithholdingTaxCount === 1 ? "" : "s"}`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const fxLabel = fxFallback
    ? "Using fallback FX rates; totals are approximate."
    : fxAsOf
      ? `FX rates as of ${new Date(fxAsOf).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}.`
      : "FX rates are indicative.";

  return (
    <Card className="grid gap-3 p-4 md:grid-cols-3">
      <GuidanceItem
        icon={hasDataIssue ? AlertTriangle : ShieldCheck}
        tone={hasDataIssue ? "text-amber-300" : "text-emerald-300"}
        label="Data confidence"
        title={
          unpricedCount > 0
            ? "Incomplete pricing"
            : hasMissingFx
              ? "Missing FX conversion"
              : fxFallback
              ? "Approximate FX"
              : "Indicative prices"
        }
        body={
          unpricedCount > 0
            ? `${unpricedCount} holding${unpricedCount === 1 ? "" : "s"} missing a quote. Portfolio value and P/L exclude those positions.${fxFallback ? " FX is also using fallback rates." : ""}`
            : hasMissingFx
              ? `${missingFxLabel} cannot be converted to ${base}. Totals exclude those values.`
            : `Market data refreshed ${refreshedLabel || "recently"}. ${fxLabel} Verify with your broker before trading.`
        }
      />
      <GuidanceItem
        icon={Target}
        tone={hasTarget ? "text-emerald-300" : "text-sky-300"}
        label="Portfolio plan"
        title={hasTarget ? "Target is set" : "No target yet"}
        body={
          hasTarget
            ? "Drift is compared against the target mix you chose."
            : "Create a risk profile or model portfolio to make drift useful."
        }
        href="/design#risk"
        action={hasTarget ? "Review plan" : "Set target"}
      />
      <GuidanceItem
        icon={HistoryIcon}
        tone="text-zinc-300"
        label="Audit trail"
        title={`${transactionsCount} transactions`}
        body="Holdings, average cost, and P/L are derived from your transaction history."
        href="/history"
        action="Review history"
      />
    </Card>
  );
}

function GuidanceItem({
  icon: Icon,
  tone,
  label,
  title,
  body,
  href,
  action,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  label: string;
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className={tone} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{body}</p>
      {action && (
        <span className="mt-2 inline-block text-xs font-medium text-indigo-300">
          {action}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 transition hover:border-zinc-600 hover:bg-zinc-900/60"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      {content}
    </div>
  );
}

function ClosedPortfolioPanel() {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-white">
          No open positions
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Your transaction history is still active, so Folio keeps showing
          booked P/L, income, and historical P/L instead of resetting the
          dashboard to onboarding.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/history">
          <Button size="sm" variant="outline">
            <HistoryIcon size={14} /> Review history
          </Button>
        </Link>
        <Link href="/add">
          <Button size="sm">
            <PlusCircle size={14} /> Add position
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function MessageBanner({
  profit,
  incomplete,
  closed = false,
}: {
  profit: boolean;
  incomplete: boolean;
  closed?: boolean;
}) {
  if (incomplete) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-center text-sm text-amber-100/90">
        Some valuation inputs are missing, so Folio is showing partial P/L.
        Resolve quotes or FX before treating this as performance.
      </div>
    );
  }

  if (closed) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 px-5 py-4 text-center text-sm text-zinc-300">
        Portfolio is closed for now. Booked results remain visible for audit,
        tax, and reconciliation work.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4 text-center text-sm",
        profit
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/90"
          : "border-rose-500/20 bg-rose-500/5 text-rose-200/90",
      )}
    >
      “{pickMessage(profit)}”
    </div>
  );
}

function Legend({
  i,
  label,
  weight,
}: {
  i: number;
  label: string;
  weight: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: colorForIndex(i) }}
      />
      <span className="text-zinc-300">{label}</span>
      <span className="ml-auto text-zinc-500 tabular">
        {(weight * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/60" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-zinc-800/40"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-800/40" />
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-800/40" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-2xl font-bold text-white">
        ƒ
      </span>
      <h2 className="text-lg font-semibold text-white">No holdings yet</h2>
      <p className="max-w-sm text-sm text-zinc-400">
        Add your first trade, fund, listed bond fund, money market fund, or cash
        balance and watch your allocation come to life in real time.
      </p>
      <Link href="/add">
        <Button>
          <PlusCircle size={16} /> Add a transaction
        </Button>
      </Link>
    </Card>
  );
}
