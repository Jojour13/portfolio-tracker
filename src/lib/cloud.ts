// ---------------------------------------------------------------------------
// Cloud sync layer (optional). Maps the local store <-> Supabase tables.
// Every query is scoped to the signed-in user and further protected by
// Row-Level Security on the database, so one user can never read another's
// rows even though the anon API key is public.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset, Settings, Transaction } from "./types";

let client: SupabaseClient | null = null;
let userId: string | null = null;

export function activateCloud(c: SupabaseClient, uid: string) {
  client = c;
  userId = uid;
}
export function deactivateCloud() {
  client = null;
  userId = null;
}
export function cloudActive() {
  return Boolean(client && userId);
}

async function expectOk<T extends { error: { message?: string } | null }>(
  operation: PromiseLike<T>,
  label: string,
) {
  const { error } = await operation;
  if (error) {
    throw new Error(`${label} failed: ${error.message ?? "Unknown Supabase error."}`);
  }
}

async function remoteIds(table: "assets" | "transactions", label: string) {
  if (!cloudActive()) return new Set<string>();
  const { data, error } = await client!
    .from(table)
    .select("id")
    .eq("user_id", userId);
  if (error) {
    throw new Error(`${label} failed: ${error.message ?? "Unknown Supabase error."}`);
  }
  return new Set((data ?? []).map((row: { id: string }) => row.id));
}

function idsToDelete(existing: Set<string>, next: { id: string }[]) {
  const keep = new Set(next.map((row) => row.id));
  return [...existing].filter((id) => !keep.has(id));
}

// --- row <-> domain mappers ------------------------------------------------
function assetRow(a: Asset) {
  return {
    id: a.id,
    user_id: userId,
    type: a.type,
    symbol: a.symbol,
    name: a.name,
    currency: a.currency,
    quote_source: a.quoteSource,
    quote_id: a.quoteId,
    lot_size: a.lotSize,
  };
}
function assetFromRow(r: any): Asset {
  return {
    id: r.id,
    type: r.type,
    symbol: r.symbol,
    name: r.name,
    currency: r.currency,
    quoteSource: r.quote_source,
    quoteId: r.quote_id,
    lotSize: Number(r.lot_size),
  };
}
function txnRow(t: Transaction) {
  return {
    id: t.id,
    user_id: userId,
    asset_id: t.assetId,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    fee: t.fee,
    date: t.date,
    note: t.note ?? null,
    settlement_id: t.settlementId ?? null,
    cash_flow_type: t.cashFlowType ?? null,
    income_category: t.incomeCategory ?? null,
    income_asset_id: t.incomeAssetId ?? null,
    withholding_tax: t.withholdingTax ?? null,
    margin: t.margin ?? null,
    leverage: t.leverage ?? null,
  };
}
function txnFromRow(r: any): Transaction {
  return {
    id: r.id,
    assetId: r.asset_id,
    side: r.side,
    quantity: Number(r.quantity),
    price: Number(r.price),
    fee: Number(r.fee),
    date: r.date,
    note: r.note ?? undefined,
    settlementId: r.settlement_id ?? undefined,
    cashFlowType: r.cash_flow_type ?? undefined,
    incomeCategory: r.income_category ?? undefined,
    incomeAssetId: r.income_asset_id ?? undefined,
    withholdingTax:
      r.withholding_tax != null ? Number(r.withholding_tax) : undefined,
    margin: r.margin ?? undefined,
    leverage: r.leverage != null ? Number(r.leverage) : undefined,
  };
}

// --- write-through (fire and forget from the store) ------------------------
export async function pushAsset(a: Asset) {
  if (!cloudActive()) return;
  await expectOk(
    client!.from("assets").upsert(assetRow(a), { onConflict: "user_id,id" }),
    "Cloud asset save",
  );
}
export async function pushTransaction(t: Transaction) {
  if (!cloudActive()) return;
  await expectOk(
    client!
      .from("transactions")
      .upsert(txnRow(t), { onConflict: "user_id,id" }),
    "Cloud transaction save",
  );
}
export async function deleteTransactionRemote(id: string) {
  if (!cloudActive()) return;
  await expectOk(
    client!.from("transactions").delete().eq("user_id", userId).eq("id", id),
    "Cloud transaction delete",
  );
}
export async function deleteTransactionsRemote(ids: string[]) {
  if (!cloudActive() || ids.length === 0) return;
  await expectOk(
    client!.from("transactions").delete().eq("user_id", userId).in("id", ids),
    "Cloud transaction delete",
  );
}
async function deleteAssetsRemote(ids: string[]) {
  if (!cloudActive() || ids.length === 0) return;
  await expectOk(
    client!.from("assets").delete().eq("user_id", userId).in("id", ids),
    "Cloud asset delete",
  );
}

async function pushAssetsRemote(assets: Asset[]) {
  if (!cloudActive() || assets.length === 0) return;
  await expectOk(
    client!
      .from("assets")
      .upsert(assets.map(assetRow), { onConflict: "user_id,id" }),
    "Cloud asset seed",
  );
}

async function pushTransactionsRemote(transactions: Transaction[]) {
  if (!cloudActive() || transactions.length === 0) return;
  await expectOk(
    client!
      .from("transactions")
      .upsert(transactions.map(txnRow), { onConflict: "user_id,id" }),
    "Cloud transaction seed",
  );
}

export async function clearRemotePortfolio() {
  if (!cloudActive()) return;
  await expectOk(
    client!.from("transactions").delete().eq("user_id", userId),
    "Cloud transaction clear",
  );
  await expectOk(
    client!.from("assets").delete().eq("user_id", userId),
    "Cloud asset clear",
  );
}
export async function pushSettings(s: Settings) {
  if (!cloudActive()) return;
  await expectOk(
    client!.from("settings").upsert({
      user_id: userId,
      base_currency: s.baseCurrency,
      refresh_interval: s.refreshIntervalSec,
    }),
    "Cloud settings save",
  );
}

// --- pull on login ---------------------------------------------------------
export async function pullAll(): Promise<{
  assets: Asset[];
  transactions: Transaction[];
  settings: Partial<Settings>;
} | null> {
  if (!cloudActive()) return null;
  const [a, t, s] = await Promise.all([
    client!.from("assets").select("*"),
    client!
      .from("transactions")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    client!.from("settings").select("*").maybeSingle(),
  ]);
  if (a.error) throw new Error(`Cloud assets pull failed: ${a.error.message}`);
  if (t.error) {
    throw new Error(`Cloud transactions pull failed: ${t.error.message}`);
  }
  if (s.error) throw new Error(`Cloud settings pull failed: ${s.error.message}`);
  return {
    assets: (a.data ?? []).map(assetFromRow),
    transactions: (t.data ?? []).map(txnFromRow),
    settings: s.data
      ? {
          baseCurrency: s.data.base_currency,
          refreshIntervalSec: s.data.refresh_interval,
        }
      : {},
  };
}

/** Push the entire local portfolio up (used to seed the cloud on first login). */
export async function pushAll(
  assets: Asset[],
  transactions: Transaction[],
  settings: Settings,
) {
  if (!cloudActive()) return;
  await pushAssetsRemote(assets);
  await pushTransactionsRemote(transactions);
  await pushSettings(settings);
}

/** Replace the user's remote rows exactly with the provided local portfolio. */
export async function replaceRemotePortfolio(
  assets: Asset[],
  transactions: Transaction[],
  settings: Settings,
) {
  if (!cloudActive()) return;
  const [existingAssetIds, existingTransactionIds] = await Promise.all([
    remoteIds("assets", "Cloud asset inventory"),
    remoteIds("transactions", "Cloud transaction inventory"),
  ]);
  const staleTransactionIds = idsToDelete(existingTransactionIds, transactions);
  const staleAssetIds = idsToDelete(existingAssetIds, assets);

  // Delete stale rows before upserting replacements so unique asset identities
  // such as (user, type, quote_id) are freed during backup restore.
  await deleteTransactionsRemote(staleTransactionIds);
  await deleteAssetsRemote(staleAssetIds);
  await pushAssetsRemote(assets);
  await pushTransactionsRemote(transactions);
  await pushSettings(settings);
}
