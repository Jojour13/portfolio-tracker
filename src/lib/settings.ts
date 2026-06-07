import {
  CURRENCIES,
  TARGET_CLASSES,
  TARGET_CLASS_LABEL,
  type Currency,
  type Settings,
  type TargetAllocation,
} from "./types";

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: "IDR",
  refreshIntervalSec: 30,
  riskFreeRate: 0.0575,
};

export function clearLocalOnlyPlanSettings(
  settings: Partial<Settings> = {},
): Partial<Settings> {
  return {
    ...settings,
    riskFreeRate: DEFAULT_SETTINGS.riskFreeRate,
    riskProfile: undefined,
    targetAllocation: undefined,
    rebalanceThreshold: undefined,
  };
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency);
}

function isRiskProfile(
  value: unknown,
): value is NonNullable<Settings["riskProfile"]> {
  return (
    value === "conservative" ||
    value === "balanced" ||
    value === "growth" ||
    value === "aggressive" ||
    value === "custom"
  );
}

function readTargetAllocation(value: unknown): TargetAllocation | null {
  if (typeof value !== "object" || value === null) return null;
  const allocation = value as Record<string, unknown>;
  const fixedIncome = allocation.fixedIncome ?? 0;
  const next: Record<keyof TargetAllocation, unknown> = {
    crypto: allocation.crypto,
    stock: allocation.stock,
    fixedIncome,
    cash: allocation.cash,
  };
  for (const key of TARGET_CLASSES) {
    const weight = next[key];
    if (!isFiniteNumber(weight) || weight < 0) return null;
  }
  const total = TARGET_CLASSES.reduce((sum, key) => sum + (next[key] as number), 0);
  if (Math.abs(total - 1) > 0.0001) return null;
  return {
    crypto: next.crypto as number,
    stock: next.stock as number,
    fixedIncome: next.fixedIncome as number,
    cash: next.cash as number,
  };
}

function isTargetAllocation(value: unknown): value is TargetAllocation {
  return readTargetAllocation(value) !== null;
}

function targetAllocationError(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Settings target allocation must be an object with crypto, equity/funds, fixed income, and cash weights.";
  }
  const allocation = value as Record<string, unknown>;
  for (const label of TARGET_CLASSES) {
    const amount = label === "fixedIncome" ? allocation[label] ?? 0 : allocation[label];
    if (!isFiniteNumber(amount) || amount < 0) {
      return `Settings target allocation ${TARGET_CLASS_LABEL[label]} weight must be a non-negative number.`;
    }
  }
  const total = TARGET_CLASSES.reduce((sum, label) => {
    const amount = label === "fixedIncome" ? allocation[label] ?? 0 : allocation[label];
    return sum + (isFiniteNumber(amount) ? amount : 0);
  }, 0);
  if (Math.abs(total - 1) > 0.0001) {
    return "Settings target allocation weights must add up to 100%.";
  }
  return null;
}

export function validateSettingsPatch(settings?: Partial<Settings>) {
  if (!settings) return null;
  if (hasOwn(settings, "baseCurrency") && !isCurrency(settings.baseCurrency)) {
    return "Settings base currency is invalid.";
  }
  if (
    hasOwn(settings, "refreshIntervalSec") &&
    (!isFiniteNumber(settings.refreshIntervalSec) ||
      settings.refreshIntervalSec <= 0)
  ) {
    return "Settings refresh interval is invalid.";
  }
  if (
    hasOwn(settings, "riskFreeRate") &&
    (!isFiniteNumber(settings.riskFreeRate) ||
      settings.riskFreeRate <= -1 ||
      settings.riskFreeRate > 1)
  ) {
    return "Settings risk-free rate is invalid.";
  }
  if (
    hasOwn(settings, "riskProfile") &&
    settings.riskProfile !== undefined &&
    !isRiskProfile(settings.riskProfile)
  ) {
    return "Settings risk profile is invalid.";
  }
  if (
    hasOwn(settings, "targetAllocation") &&
    settings.targetAllocation !== undefined &&
    !isTargetAllocation(settings.targetAllocation)
  ) {
    return "Settings target allocation is invalid.";
  }
  if (
    settings.riskProfile !== undefined &&
    !isTargetAllocation(settings.targetAllocation)
  ) {
    return "Settings risk profile requires a valid target allocation.";
  }
  if (
    hasOwn(settings, "rebalanceThreshold") &&
    settings.rebalanceThreshold !== undefined &&
    (!isFiniteNumber(settings.rebalanceThreshold) ||
      settings.rebalanceThreshold < 0 ||
      settings.rebalanceThreshold > 1)
  ) {
    return "Settings rebalance threshold is invalid.";
  }
  return null;
}

export type ReadSettingsResult =
  | { ok: true; settings: Partial<Settings> }
  | { ok: false; error: string };

export function readSettingsResult(value: unknown): ReadSettingsResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Backup settings must be a JSON object." };
  }
  const source = value as Record<string, unknown>;
  const out: Partial<Settings> = {};

  if (hasOwn(source, "baseCurrency")) {
    if (!isCurrency(source.baseCurrency)) {
      return {
        ok: false,
        error: `Settings base currency must be one of ${CURRENCIES.join(", ")}.`,
      };
    }
    out.baseCurrency = source.baseCurrency;
  }
  if (hasOwn(source, "refreshIntervalSec")) {
    if (
      !isFiniteNumber(source.refreshIntervalSec) ||
      source.refreshIntervalSec <= 0
    ) {
      return {
        ok: false,
        error: "Settings refresh interval must be a positive number.",
      };
    }
    out.refreshIntervalSec = source.refreshIntervalSec;
  }
  if (hasOwn(source, "riskFreeRate")) {
    if (
      !isFiniteNumber(source.riskFreeRate) ||
      source.riskFreeRate <= -1 ||
      source.riskFreeRate > 1
    ) {
      return {
        ok: false,
        error: "Settings risk-free rate must be greater than -100% and no more than 100%.",
      };
    }
    out.riskFreeRate = source.riskFreeRate;
  }
  if (hasOwn(source, "riskProfile")) {
    if (!isRiskProfile(source.riskProfile)) {
      return {
        ok: false,
        error:
          "Settings risk profile must be conservative, balanced, growth, aggressive, or custom.",
      };
    }
    out.riskProfile = source.riskProfile;
  }
  if (hasOwn(source, "targetAllocation")) {
    const targetAllocation = readTargetAllocation(source.targetAllocation);
    if (!targetAllocation) {
      return {
        ok: false,
        error:
          targetAllocationError(source.targetAllocation) ??
          "Settings target allocation is invalid.",
      };
    }
    out.targetAllocation = targetAllocation;
  }
  if (hasOwn(source, "rebalanceThreshold")) {
    if (
      !isFiniteNumber(source.rebalanceThreshold) ||
      source.rebalanceThreshold < 0 ||
      source.rebalanceThreshold > 1
    ) {
      return {
        ok: false,
        error: "Settings rebalance threshold must be between 0% and 100%.",
      };
    }
    out.rebalanceThreshold = source.rebalanceThreshold;
  }

  const patchError = validateSettingsPatch(out);
  if (patchError) return { ok: false, error: patchError };
  return { ok: true, settings: out };
}

export function readSettings(value: unknown): Partial<Settings> | null {
  const result = readSettingsResult(value);
  return result.ok ? result.settings : null;
}

export function sanitizeSettings(settings: unknown): Settings {
  const source =
    typeof settings === "object" && settings !== null
      ? (settings as Partial<Settings>)
      : {};
  const next: Settings = { ...DEFAULT_SETTINGS };

  if (isCurrency(source.baseCurrency)) {
    next.baseCurrency = source.baseCurrency;
  }
  if (isFiniteNumber(source.refreshIntervalSec) && source.refreshIntervalSec > 0) {
    next.refreshIntervalSec = source.refreshIntervalSec;
  }
  if (
    isFiniteNumber(source.riskFreeRate) &&
    source.riskFreeRate > -1 &&
    source.riskFreeRate <= 1
  ) {
    next.riskFreeRate = source.riskFreeRate;
  }
  const targetAllocation = readTargetAllocation(source.targetAllocation);
  if (targetAllocation) {
    next.targetAllocation = targetAllocation;
  }
  if (isRiskProfile(source.riskProfile) && next.targetAllocation) {
    next.riskProfile = source.riskProfile;
  }
  if (
    isFiniteNumber(source.rebalanceThreshold) &&
    source.rebalanceThreshold >= 0 &&
    source.rebalanceThreshold <= 1
  ) {
    next.rebalanceThreshold = source.rebalanceThreshold;
  }

  return next;
}
