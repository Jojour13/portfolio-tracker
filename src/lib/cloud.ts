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
  };
}

// --- write-through (fire and forget from the store) ------------------------
export async function pushAsset(a: Asset) {
  if (!cloudActive()) return;
  await client!.from("assets").upsert(assetRow(a));
}
export async function pushTransaction(t: Transaction) {
  if (!cloudActive()) return;
  await client!.from("transactions").upsert(txnRow(t));
}
export async function deleteTransactionRemote(id: string) {
  if (!cloudActive()) return;
  await client!.from("transactions").delete().eq("id", id);
}
export async function pushSettings(s: Settings) {
  if (!cloudActive()) return;
  await client!.from("settings").upsert({
    user_id: userId,
    base_currency: s.baseCurrency,
    refresh_interval: s.refreshIntervalSec,
  });
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
    client!.from("transactions").select("*"),
    client!.from("settings").select("*").maybeSingle(),
  ]);
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
  if (assets.length)
    await client!.from("assets").upsert(assets.map(assetRow));
  if (transactions.length)
    await client!.from("transactions").upsert(transactions.map(txnRow));
  await pushSettings(settings);
}
