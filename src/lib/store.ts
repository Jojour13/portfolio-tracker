"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Asset,
  Currency,
  ModelHolding,
  Settings,
  Transaction,
  TxnSide,
} from "./types";
import { uid } from "./utils";
import {
  pushAsset,
  pushTransaction,
  deleteTransactionRemote,
  pushSettings,
} from "./cloud";

export interface NewAssetInput {
  type: Asset["type"];
  symbol: string;
  name: string;
  currency: Currency;
  quoteSource: Asset["quoteSource"];
  quoteId: string;
  lotSize: number;
}

export interface NewTxnInput {
  side: TxnSide;
  quantity: number;
  price: number;
  fee?: number;
  date?: string;
  note?: string;
  margin?: boolean;
  leverage?: number;
}

interface FolioState {
  assets: Asset[];
  transactions: Transaction[];
  settings: Settings;
  hydrated: boolean;
  /** When true, all monetary amounts are blurred for screenshots in public. */
  censored: boolean;
  /** A designed model/target portfolio (a plan, separate from real holdings). */
  modelPortfolio: ModelHolding[];

  setHydrated: () => void;
  toggleCensor: () => void;
  addModelHolding: (h: Omit<ModelHolding, "id">) => void;
  updateModelQty: (id: string, qty: number) => void;
  removeModelHolding: (id: string) => void;
  clearModel: () => void;
  /** Find an existing asset by quoteId or create one, returning its id. */
  upsertAsset: (input: NewAssetInput) => string;
  addTransaction: (assetId: string, txn: NewTxnInput) => void;
  deleteTransaction: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSample: () => void;
  clearAll: () => void;
  /** Replace the whole portfolio (used when pulling from the cloud on login). */
  replaceAll: (data: {
    assets: Asset[];
    transactions: Transaction[];
    settings?: Partial<Settings>;
  }) => void;
}

const SAMPLE_ASSETS: Asset[] = [
  { id: "a-btc", type: "crypto", symbol: "BTC", name: "Bitcoin", currency: "USD", quoteSource: "yahoo", quoteId: "BTC-USD", lotSize: 1 },
  { id: "a-eth", type: "crypto", symbol: "ETH", name: "Ethereum", currency: "USD", quoteSource: "yahoo", quoteId: "ETH-USD", lotSize: 1 },
  { id: "a-bbca", type: "stock", symbol: "BBCA", name: "Bank Central Asia", currency: "IDR", quoteSource: "yahoo", quoteId: "BBCA.JK", lotSize: 100 },
  { id: "a-dbs", type: "stock", symbol: "D05", name: "DBS Group", currency: "SGD", quoteSource: "yahoo", quoteId: "D05.SI", lotSize: 1 },
  { id: "a-aapl", type: "stock", symbol: "AAPL", name: "Apple Inc.", currency: "USD", quoteSource: "yahoo", quoteId: "AAPL", lotSize: 1 },
  { id: "a-cash-idr", type: "cash", symbol: "IDR", name: "Cash (IDR)", currency: "IDR", quoteSource: "cash", quoteId: "cash-idr", lotSize: 1 },
  { id: "a-cash-usd", type: "cash", symbol: "USD", name: "Cash (USD)", currency: "USD", quoteSource: "cash", quoteId: "cash-usd", lotSize: 1 },
];

const SAMPLE_TXNS: Transaction[] = [
  { id: "t1", assetId: "a-btc", side: "buy", quantity: 0.25, price: 42000, fee: 5, date: "2025-11-10", note: "DCA" },
  { id: "t2", assetId: "a-btc", side: "buy", quantity: 0.15, price: 61000, fee: 4, date: "2026-02-01", note: "DCA" },
  { id: "t3", assetId: "a-eth", side: "buy", quantity: 3, price: 2300, fee: 3, date: "2025-12-05" },
  { id: "t4", assetId: "a-bbca", side: "buy", quantity: 1000, price: 9200, fee: 0, date: "2025-10-15", note: "10 lots" },
  { id: "t5", assetId: "a-dbs", side: "buy", quantity: 200, price: 38.5, fee: 10, date: "2025-09-20" },
  { id: "t6", assetId: "a-aapl", side: "buy", quantity: 20, price: 188, fee: 1, date: "2026-01-12" },
  { id: "t7", assetId: "a-cash-idr", side: "buy", quantity: 25_000_000, price: 1, fee: 0, date: "2026-03-01", note: "Idle cash" },
  { id: "t8", assetId: "a-cash-usd", side: "buy", quantity: 1500, price: 1, fee: 0, date: "2026-03-01" },
];

const DEFAULT_SETTINGS: Settings = {
  baseCurrency: "IDR",
  refreshIntervalSec: 30,
  riskFreeRate: 0.0575,
};

export const useFolio = create<FolioState>()(
  persist(
    (set, get) => ({
      assets: SAMPLE_ASSETS,
      transactions: SAMPLE_TXNS,
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      censored: false,
      modelPortfolio: [],

      setHydrated: () => set({ hydrated: true }),
      toggleCensor: () => set((s) => ({ censored: !s.censored })),

      addModelHolding: (h) =>
        set((s) => {
          // merge into an existing same-asset row instead of duplicating
          const i = s.modelPortfolio.findIndex(
            (m) => m.quoteId === h.quoteId && m.type === h.type,
          );
          if (i >= 0) {
            const next = [...s.modelPortfolio];
            next[i] = { ...next[i], qty: next[i].qty + h.qty };
            return { modelPortfolio: next };
          }
          return {
            modelPortfolio: [...s.modelPortfolio, { id: "m-" + uid(), ...h }],
          };
        }),
      updateModelQty: (id, qty) =>
        set((s) => ({
          modelPortfolio: s.modelPortfolio.map((m) =>
            m.id === id ? { ...m, qty } : m,
          ),
        })),
      removeModelHolding: (id) =>
        set((s) => ({
          modelPortfolio: s.modelPortfolio.filter((m) => m.id !== id),
        })),
      clearModel: () => set({ modelPortfolio: [] }),

      upsertAsset: (input) => {
        const existing = get().assets.find(
          (a) => a.quoteId === input.quoteId && a.type === input.type,
        );
        if (existing) return existing.id;
        const id = "a-" + uid();
        const asset: Asset = { id, ...input };
        set((s) => ({ assets: [...s.assets, asset] }));
        void pushAsset(asset);
        return id;
      },

      addTransaction: (assetId, txn) => {
        const t: Transaction = {
          id: "t-" + uid(),
          assetId,
          side: txn.side,
          quantity: txn.quantity,
          price: txn.price,
          fee: txn.fee ?? 0,
          date: txn.date ?? new Date().toISOString().slice(0, 10),
          note: txn.note,
          margin: txn.margin,
          leverage: txn.leverage,
        };
        set((s) => ({ transactions: [...s.transactions, t] }));
        void pushTransaction(t);
      },

      deleteTransaction: (id) => {
        set((s) => ({
          transactions: s.transactions.filter((t) => t.id !== id),
        }));
        void deleteTransactionRemote(id);
      },

      updateSettings: (patch) =>
        set((s) => {
          const next = { ...s.settings, ...patch };
          void pushSettings(next);
          return { settings: next };
        }),

      resetSample: () =>
        set({ assets: SAMPLE_ASSETS, transactions: SAMPLE_TXNS }),

      clearAll: () => set({ assets: [], transactions: [] }),

      replaceAll: ({ assets, transactions, settings }) =>
        set((s) => ({
          assets,
          transactions,
          settings: settings ? { ...s.settings, ...settings } : s.settings,
        })),
    }),
    {
      name: "folio-store-v1",
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
