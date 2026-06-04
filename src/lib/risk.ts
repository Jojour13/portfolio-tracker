import type { RiskProfile, TargetAllocation, ValuedPosition } from "./types";

export interface RiskQuestion {
  id: string;
  q: string;
  options: { label: string; score: number }[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "horizon",
    q: "When will you need most of this money?",
    options: [
      { label: "Within 1 year", score: 1 },
      { label: "1–3 years", score: 2 },
      { label: "3–7 years", score: 3 },
      { label: "7+ years", score: 4 },
    ],
  },
  {
    id: "drawdown",
    q: "Your portfolio drops 30% in a month. You…",
    options: [
      { label: "Sell most to stop the bleeding", score: 1 },
      { label: "Sell a little", score: 2 },
      { label: "Hold and wait", score: 3 },
      { label: "Buy more — it's on sale", score: 4 },
    ],
  },
  {
    id: "goal",
    q: "Your main goal for this portfolio",
    options: [
      { label: "Protect what I have", score: 1 },
      { label: "Steady, reliable growth", score: 2 },
      { label: "Grow it meaningfully", score: 3 },
      { label: "Maximise returns, accept big swings", score: 4 },
    ],
  },
  {
    id: "experience",
    q: "Your experience with volatile assets (crypto, small caps)",
    options: [
      { label: "None", score: 1 },
      { label: "A little", score: 2 },
      { label: "Comfortable", score: 3 },
      { label: "Very experienced", score: 4 },
    ],
  },
  {
    id: "stake",
    q: "This portfolio is…",
    options: [
      { label: "Most of my savings", score: 1 },
      { label: "A large part", score: 2 },
      { label: "A moderate part", score: 3 },
      { label: "Money I can afford to lose", score: 4 },
    ],
  },
];

/** Total score ranges 5..20 -> profile. */
export function scoreToProfile(total: number): Exclude<RiskProfile, "custom"> {
  if (total <= 8) return "conservative";
  if (total <= 12) return "balanced";
  if (total <= 16) return "growth";
  return "aggressive";
}

export const PROFILE_TARGETS: Record<
  Exclude<RiskProfile, "custom">,
  TargetAllocation
> = {
  conservative: { crypto: 0.05, stock: 0.45, cash: 0.5 },
  balanced: { crypto: 0.15, stock: 0.6, cash: 0.25 },
  growth: { crypto: 0.3, stock: 0.6, cash: 0.1 },
  aggressive: { crypto: 0.5, stock: 0.45, cash: 0.05 },
};

export const PROFILE_LABEL: Record<RiskProfile, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  growth: "Growth",
  aggressive: "Aggressive",
  custom: "Custom",
};

export const PROFILE_BLURB: Record<RiskProfile, string> = {
  conservative: "Capital preservation first. Mostly cash & blue chips.",
  balanced: "A steady core with a measured dose of growth.",
  growth: "Tilted to growth; comfortable with real volatility.",
  aggressive: "Maximise upside, stomach big drawdowns.",
  custom: "Your own target mix.",
};

/** Current allocation by asset class (fractions). */
export function currentAllocation(
  positions: ValuedPosition[],
): TargetAllocation {
  let crypto = 0;
  let stock = 0;
  let cash = 0;
  for (const p of positions) {
    const v = p.marketValueBase ?? 0;
    if (p.asset.type === "crypto") crypto += v;
    else if (p.asset.type === "stock") stock += v;
    else cash += v;
  }
  const total = crypto + stock + cash;
  if (total <= 0) return { crypto: 0, stock: 0, cash: 0 };
  return { crypto: crypto / total, stock: stock / total, cash: cash / total };
}

export interface Drift {
  cls: keyof TargetAllocation;
  current: number;
  target: number;
  diff: number; // current - target
}

export function computeDrift(
  current: TargetAllocation,
  target: TargetAllocation,
): Drift[] {
  return (["crypto", "stock", "cash"] as (keyof TargetAllocation)[]).map(
    (k) => ({ cls: k, current: current[k], target: target[k], diff: current[k] - target[k] }),
  );
}

export function maxDrift(drifts: Drift[]): number {
  return drifts.reduce((m, d) => Math.max(m, Math.abs(d.diff)), 0);
}
