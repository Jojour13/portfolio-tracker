// ---------------------------------------------------------------------------
// Folio domain model
// ---------------------------------------------------------------------------
// We store ASSETS (what you can hold) and TRANSACTIONS (what you did).
// Positions, average cost, and P/L are always *derived* from transactions so
// the trade history stays the single source of truth.
// ---------------------------------------------------------------------------

export type AssetType = "crypto" | "stock" | "cash";

export type Currency = "USD" | "IDR" | "SGD" | "CHF" | "EUR";

export const CURRENCIES: Currency[] = ["USD", "IDR", "SGD", "CHF", "EUR"];

/** Where a live price is fetched from. */
export type QuoteSource = "coingecko" | "yahoo" | "cash";

export interface Asset {
  id: string;
  type: AssetType;
  /** Display ticker, e.g. "BTC", "BBCA", "AAPL", "D05". */
  symbol: string;
  /** Full name, e.g. "Bitcoin", "Bank Central Asia". */
  name: string;
  /** Native trading currency of the asset. */
  currency: Currency;
  quoteSource: QuoteSource;
  /** Provider-specific id: coingecko id ("bitcoin") or yahoo symbol ("BBCA.JK"). */
  quoteId: string;
  /** Shares per lot. 1 for crypto / US / SG, 100 for IDX. */
  lotSize: number;
}

export type TxnSide = "buy" | "sell";

export interface Transaction {
  id: string;
  assetId: string;
  side: TxnSide;
  /** In base units (coins / shares). For IDX this is lots * 100. */
  quantity: number;
  /** Price per unit, in the asset's native currency. */
  price: number;
  /** Fee/commission, in the asset's native currency. */
  fee: number;
  /** ISO date string. */
  date: string;
  note?: string;
  /** Whether this trade used margin/leverage. Absent = cash (1x). */
  margin?: boolean;
  /** Leverage multiple, e.g. 3 for 3x. Absent/1 = unleveraged. */
  leverage?: number;
}

/** A holding derived from all of an asset's transactions. */
export interface Position {
  asset: Asset;
  quantity: number;
  /** Weighted-average cost per unit (native currency) of the remaining quantity. */
  avgCost: number;
  /** Cost basis of the remaining quantity = quantity * avgCost. */
  invested: number;
  /** Realised P/L from sells so far (native currency). */
  realizedPnl: number;
  // --- margin (cost-weighted across the remaining position) ---
  /** Effective leverage of the remaining position. 1 = unleveraged. */
  leverage: number;
  /** Own capital actually at risk (native currency) = invested / leverage. */
  equityInvested: number;
  /** Borrowed amount funding the position (native currency). */
  borrowed: number;
}

/** A position enriched with a live price and converted to the base currency. */
export interface ValuedPosition extends Position {
  price: number | null;
  /** Previous close, used for the day-change figure. */
  prevClose: number | null;
  marketValueNative: number | null;
  marketValueBase: number | null;
  investedBase: number;
  unrealizedPnlNative: number | null;
  unrealizedPnlPct: number | null;
  /** Return measured against own capital (leveraged %). */
  pnlPctOnEquity: number | null;
  dayChangePct: number | null;
  /** Price at which a leveraged long is liquidated (native currency). */
  liqPrice: number | null;
  /** How far price can fall before liquidation, as a fraction (0..1). */
  distanceToLiqPct: number | null;
  /** Share of total portfolio value, 0..1. */
  weight: number;
}

export type RiskProfile =
  | "conservative"
  | "balanced"
  | "growth"
  | "aggressive"
  | "custom";

/** Target allocation by asset class (fractions that sum to 1). */
export interface TargetAllocation {
  crypto: number;
  stock: number;
  cash: number;
}

export interface Settings {
  baseCurrency: Currency;
  refreshIntervalSec: number;
  /** Annual risk-free rate for Sharpe (e.g. 0.0575 = BI 7-day repo). */
  riskFreeRate: number;
  /** Chosen risk profile, set via the questionnaire. */
  riskProfile?: RiskProfile;
  /** Ideal allocation to rebalance toward. */
  targetAllocation?: TargetAllocation;
  /** Drift threshold (fraction) that triggers a rebalance signal. */
  rebalanceThreshold?: number;
}

export interface PortfolioSnapshot {
  positions: ValuedPosition[];
  totalValueBase: number;
  totalInvestedBase: number;
  totalUnrealizedPnlBase: number;
  totalUnrealizedPnlPct: number;
  /** Realised P/L from closed/partially-closed positions, base currency. */
  totalRealizedBase: number;
  dayChangeBase: number;
  dayChangePct: number;
}

/**
 * A holding in a *designed* model portfolio (a plan, not real trades).
 * Structurally a superset of Asset, so it can reuse the price hooks.
 */
export interface ModelHolding {
  id: string;
  type: AssetType;
  symbol: string;
  name: string;
  currency: Currency;
  quoteSource: QuoteSource;
  quoteId: string;
  lotSize: number;
  /** Shares/coins; for cash this is the amount in its currency. */
  qty: number;
}

/** Live quote returned by our price API routes, normalised across providers. */
export interface Quote {
  quoteId: string;
  price: number;
  prevClose: number | null;
  currency?: string;
}
