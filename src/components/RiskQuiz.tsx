"use client";

import { useState } from "react";
import { Check, XCircle } from "lucide-react";
import { useFolio } from "@/lib/store";
import {
  RISK_QUESTIONS,
  scoreToProfile,
  PROFILE_TARGETS,
  PROFILE_LABEL,
  PROFILE_BLURB,
} from "@/lib/risk";
import { TARGET_CLASSES, TARGET_CLASS_LABEL } from "@/lib/types";
import { Card, Button } from "./ui";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RiskQuiz() {
  const settings = useFolio((s) => s.settings);
  const updateSettings = useFolio((s) => s.updateSettings);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allAnswered = RISK_QUESTIONS.every((q) => answers[q.id] != null);
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  const profile = allAnswered ? scoreToProfile(total) : null;
  const target = profile ? PROFILE_TARGETS[profile] : null;
  const currentTarget = settings.targetAllocation;
  const currentLabel = settings.riskProfile
    ? PROFILE_LABEL[settings.riskProfile]
    : "Custom target";

  function save() {
    if (!profile || !target) return;
    setSaveError(null);
    const result = updateSettings({
      riskProfile: profile,
      targetAllocation: target,
      rebalanceThreshold: settings.rebalanceThreshold ?? 0.07,
    });
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearTarget() {
    setSaveError(null);
    const ok = confirm(
      "Clear your target allocation and stop drift comparisons? This does not change holdings, transactions, or model portfolio rows.",
    );
    if (!ok) return;
    const result = updateSettings({
      riskProfile: undefined,
      targetAllocation: undefined,
      rebalanceThreshold: undefined,
    });
    if (!result.ok) {
      setSaveError(result.error);
    }
  }

  return (
    <Card id="risk" className="space-y-5 p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">
          Risk profile &amp; target allocation
        </h2>
        {currentTarget && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Current target
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-200">
                {currentLabel}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatPercent(currentTarget.crypto, 0)} crypto /{" "}
                {formatPercent(currentTarget.stock, 0)} equity &amp; funds /{" "}
                {formatPercent(currentTarget.fixedIncome, 0)} fixed income /{" "}
                {formatPercent(currentTarget.cash, 0)} cash &amp; money market
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearTarget}
              className="justify-start text-zinc-500 hover:text-rose-300 sm:justify-center"
            >
              <XCircle size={14} /> Clear target
            </Button>
          </div>
        )}
        {saveError && currentTarget && !profile && (
          <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {saveError}
          </p>
        )}
        {!currentTarget && settings.riskProfile && (
          <p className="mt-1 text-xs text-zinc-500">
            Current: <b className="text-zinc-300">{PROFILE_LABEL[settings.riskProfile]}</b>
            {settings.targetAllocation &&
              ` - ${formatPercent(settings.targetAllocation.crypto, 0)} crypto / ${formatPercent(settings.targetAllocation.stock, 0)} equity & funds / ${formatPercent(settings.targetAllocation.fixedIncome, 0)} fixed income / ${formatPercent(settings.targetAllocation.cash, 0)} cash & money market`}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {RISK_QUESTIONS.map((q, i) => (
          <div key={q.id}>
            <p className="mb-2 text-sm text-zinc-200">
              <span className="text-zinc-500">{i + 1}.</span> {q.q}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {q.options.map((o) => (
                <button
                  type="button"
                  key={o.label}
                  onClick={() =>
                    setAnswers((a) => ({ ...a, [q.id]: o.score }))
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    answers[q.id] === o.score
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {profile && target && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Your profile
          </div>
          <div className="text-lg font-semibold text-white">
            {PROFILE_LABEL[profile]}
          </div>
          <p className="mb-3 text-xs text-zinc-400">{PROFILE_BLURB[profile]}</p>
          <div className="flex gap-2">
            {TARGET_CLASSES.map((k) => (
              <div
                key={k}
                className="flex-1 rounded-lg bg-zinc-800/60 px-3 py-2 text-center"
              >
                <div className="text-base font-semibold text-white tabular">
                  {formatPercent(target[k], 0)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {TARGET_CLASS_LABEL[k]}
                </div>
              </div>
            ))}
          </div>
          {saveError && (
            <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {saveError}
            </p>
          )}
          <Button className="mt-3 w-full" onClick={save}>
            {saved ? (
              <>
                <Check size={16} /> Saved as your target
              </>
            ) : (
              "Use this as my target allocation"
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
