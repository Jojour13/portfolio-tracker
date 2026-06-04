"use client";

import { useFolio } from "@/lib/store";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renders a monetary amount that blurs out when "censor mode" is on, so the
 * user can screenshot or share in public without exposing real balances.
 * Percentages are intentionally NOT censored — only absolute money.
 */
export function Money({
  value,
  currency,
  signed = false,
  compact = false,
  className,
}: {
  value: number | null | undefined;
  currency: Currency;
  signed?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const censored = useFolio((s) => s.censored);
  const text = censored
    ? "*****"
    : signed
      ? formatSignedMoney(value, currency)
      : formatMoney(value, currency, { compact });

  return (
    <span className={cn(censored && "select-none tracking-widest text-zinc-500", className)}>
      {text}
    </span>
  );
}
