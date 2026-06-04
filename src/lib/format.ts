import type { Currency } from "./types";

const DECIMALS: Record<Currency, number> = {
  USD: 2,
  SGD: 2,
  CHF: 2,
  EUR: 2,
  IDR: 0,
};

export function formatMoney(
  value: number | null | undefined,
  currency: Currency,
  opts: { compact?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const digits = DECIMALS[currency] ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: opts.compact ? 0 : digits,
    maximumFractionDigits: digits,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

/** Plain number with sensible precision for prices/quantities. */
export function formatNumber(
  value: number | null | undefined,
  maxDigits = 4,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxDigits,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatSignedMoney(
  value: number | null | undefined,
  currency: Currency,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return sign + formatMoney(value, currency);
}

export function pnlColor(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0)
    return "text-zinc-400";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}
