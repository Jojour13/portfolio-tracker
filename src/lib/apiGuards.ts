export const MAX_QUOTE_SYMBOLS = 80;
export const MAX_HISTORY_SYMBOLS = 40;
export const MAX_CRYPTO_IDS = 100;
export const MAX_SEARCH_QUERY_LENGTH = 80;
export const MARKET_DATA_TIMEOUT_MS = 8_000;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const YAHOO_SYMBOL_RE =
  /^(?!.*\.\.)(?:\^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,30}[A-Za-z0-9])?|[A-Za-z0-9](?:[A-Za-z0-9.-]{0,29}[A-Za-z0-9])?(?:=[A-Za-z])?)$/;
export const COINGECKO_ID_RE = /^[a-z0-9-]+$/;

type ListOptions = {
  label: string;
  maxItems: number;
  maxLength: number;
  pattern: RegExp;
};

export type ParseListResult =
  | { ok: true; values: string[] }
  | { ok: false; error: string };

export function parseCsvList(
  raw: string | null,
  { label, maxItems, maxLength, pattern }: ListOptions,
): ParseListResult {
  if (!raw) return { ok: true, values: [] };

  const values = [
    ...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean)),
  ];
  if (values.length > maxItems) {
    return { ok: false, error: `Too many ${label}. Maximum is ${maxItems}.` };
  }

  for (const value of values) {
    if (value.length > maxLength || !pattern.test(value)) {
      return { ok: false, error: `Invalid ${label} value.` };
    }
  }

  return { ok: true, values };
}

export function sanitizeSearchQuery(raw: string | null): string | null {
  const q = raw?.trim() ?? "";
  if (!q) return null;
  if (q.length > MAX_SEARCH_QUERY_LENGTH || CONTROL_CHARS.test(q)) {
    return null;
  }
  return q;
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
  timeoutMs = MARKET_DATA_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
