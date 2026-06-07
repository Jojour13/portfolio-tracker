"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import {
  type Asset,
  type CashFlowType,
  type Currency,
  type IncomeCategory,
  type ModelHolding,
  type Settings,
  type Transaction,
  type TxnSide,
} from "./types";
import { localIsoDate, uid } from "./utils";
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  validateSettingsPatch,
} from "./settings";
import {
  validateAsset,
  validateReplacement,
  validateTransaction,
} from "./portfolioValidation";
import {
  pushAsset,
  pushTransaction,
  deleteTransactionsRemote,
  clearRemotePortfolio,
  replaceRemotePortfolio,
  pushSettings,
  cloudActive,
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
  settlementId?: string;
  cashFlowType?: CashFlowType;
  incomeCategory?: IncomeCategory;
  incomeAssetId?: string;
  withholdingTax?: number;
  margin?: boolean;
  leverage?: number;
}

export interface NewTxnEntry {
  assetId: string;
  txn: NewTxnInput;
}

export interface NewAssetTxnEntry {
  asset: NewAssetInput;
  txn: NewTxnInput;
}

export type AddTransactionResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: string };

export type ReplaceAllResult = { ok: true } | { ok: false; error: string };
export type DeleteTransactionResult = { ok: true } | { ok: false; error: string };

interface FolioState {
  assets: Asset[];
  transactions: Transaction[];
  settings: Settings;
  hydrated: boolean;
  /** When true, all monetary amounts are blurred for screenshots in public. */
  censored: boolean;
  /** A designed model/target portfolio (a plan, separate from real holdings). */
  modelPortfolio: ModelHolding[];
  /** Remote write status; local browser state remains the source of truth on failure. */
  remoteWritePending: number;
  remoteWriteError: string | null;
  /** Local persistence recovery status; browser storage is treated as untrusted input. */
  localDataWarning: string | null;

  setHydrated: () => void;
  clearRemoteWriteError: () => void;
  clearLocalDataWarning: () => void;
  setLocalDataWarning: (warning: string) => void;
  retryRemoteSync: () => ReplaceAllResult;
  toggleCensor: () => void;
  addModelHolding: (h: Omit<ModelHolding, "id">) => void;
  updateModelQty: (id: string, qty: number) => void;
  removeModelHolding: (id: string) => void;
  clearModel: () => void;
  /** Find an existing asset by quoteId or create one, returning its id. */
  upsertAsset: (input: NewAssetInput) => string;
  addTransaction: (assetId: string, txn: NewTxnInput) => AddTransactionResult;
  addTransactions: (entries: NewTxnEntry[]) => AddTransactionResult;
  addAssetTransactions: (entries: NewAssetTxnEntry[]) => AddTransactionResult;
  deleteTransaction: (id: string) => DeleteTransactionResult;
  deleteTransactions: (ids: string[]) => DeleteTransactionResult;
  updateSettings: (patch: Partial<Settings>) => ReplaceAllResult;
  resetSample: () => void;
  clearAll: () => void;
  /** Replace the whole portfolio (used when pulling from the cloud on login). */
  replaceAll: (data: {
    assets: Asset[];
    transactions: Transaction[];
    settings?: Partial<Settings>;
    modelPortfolio?: ModelHolding[];
  }) => ReplaceAllResult;
}

const SAMPLE_ASSETS: Asset[] = [
  { id: "a-btc", type: "crypto", symbol: "BTC", name: "Bitcoin", currency: "USD", quoteSource: "yahoo", quoteId: "BTC-USD", lotSize: 1 },
  { id: "a-eth", type: "crypto", symbol: "ETH", name: "Ethereum", currency: "USD", quoteSource: "yahoo", quoteId: "ETH-USD", lotSize: 1 },
  { id: "a-bbca", type: "stock", symbol: "BBCA", name: "Bank Central Asia", currency: "IDR", quoteSource: "yahoo", quoteId: "BBCA.JK", lotSize: 100 },
  { id: "a-dbs", type: "stock", symbol: "D05", name: "DBS Group", currency: "SGD", quoteSource: "yahoo", quoteId: "D05.SI", lotSize: 1 },
  { id: "a-aapl", type: "stock", symbol: "AAPL", name: "Apple Inc.", currency: "USD", quoteSource: "yahoo", quoteId: "AAPL", lotSize: 1 },
  { id: "a-voo", type: "fund", symbol: "VOO", name: "Vanguard S&P 500 ETF", currency: "USD", quoteSource: "yahoo", quoteId: "VOO", lotSize: 1 },
  { id: "a-bnd", type: "bond", symbol: "BND", name: "Vanguard Total Bond ETF", currency: "USD", quoteSource: "yahoo", quoteId: "BND", lotSize: 1 },
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
  { id: "t9", assetId: "a-voo", side: "buy", quantity: 6, price: 480, fee: 1, date: "2025-12-20", note: "Core index" },
  { id: "t10", assetId: "a-bnd", side: "buy", quantity: 40, price: 73, fee: 1, date: "2026-01-05", note: "Bond ballast" },
  { id: "t7", assetId: "a-cash-idr", side: "buy", quantity: 25_000_000, price: 1, fee: 0, date: "2026-03-01", note: "Idle cash" },
  { id: "t8", assetId: "a-cash-usd", side: "buy", quantity: 1500, price: 1, fee: 0, date: "2026-03-01" },
];

let storageFallbackWarning: string | null = null;

function createMemoryStorage(): StateStorage {
  const items = new Map<string, string>();
  return {
    getItem: (name) => items.get(name) ?? null,
    setItem: (name, value) => {
      items.set(name, value);
    },
    removeItem: (name) => {
      items.delete(name);
    },
  };
}

const memoryStorage = createMemoryStorage();

function getFolioStorage(): StateStorage {
  if (typeof window === "undefined") {
    throw new Error("Browser storage is unavailable during server rendering.");
  }

  try {
    const storage = window.localStorage;
    const probe = "__folio_storage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    storageFallbackWarning = null;
    return storage;
  } catch {
    storageFallbackWarning =
      "Browser storage is unavailable. Folio is using temporary in-memory data for this session, so changes may not persist after refresh.";
    return memoryStorage;
  }
}

type PersistedFolioState = Partial<
  Pick<
    FolioState,
    "assets" | "transactions" | "settings" | "censored" | "modelPortfolio"
  >
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergePersistedState(
  persistedState: unknown,
  currentState: FolioState,
): FolioState {
  if (persistedState == null) return currentState;

  if (!isRecord(persistedState)) {
    return {
      ...currentState,
      localDataWarning:
        "Saved browser data could not be read safely. Folio loaded the built-in sample portfolio instead.",
    };
  }

  const saved = persistedState as PersistedFolioState;
  const assets = Array.isArray(saved.assets) ? saved.assets : currentState.assets;
  const transactions = Array.isArray(saved.transactions)
    ? saved.transactions
    : currentState.transactions;
  const settings = sanitizeSettings(saved.settings);
  const modelPortfolio = Array.isArray(saved.modelPortfolio)
    ? saved.modelPortfolio
    : [];
  const censored =
    typeof saved.censored === "boolean" ? saved.censored : currentState.censored;

  const error = validateReplacement({
    assets,
    transactions,
    settings,
    modelPortfolio,
  });

  if (error) {
    return {
      ...currentState,
      localDataWarning: `Saved browser data was ignored because it failed validation: ${error}`,
    };
  }

  return {
    ...currentState,
    assets,
    transactions,
    settings,
    censored,
    modelPortfolio,
    remoteWritePending: 0,
    remoteWriteError: null,
    localDataWarning: null,
    hydrated: false,
  };
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isBuiltInSamplePortfolio(
  assets: Asset[],
  transactions: Transaction[],
  modelPortfolio: ModelHolding[] = [],
) {
  return (
    modelPortfolio.length === 0 &&
    sameJson(assets, SAMPLE_ASSETS) &&
    sameJson(transactions, SAMPLE_TXNS)
  );
}

export const useFolio = create<FolioState>()(
  persist(
    (set, get) => {
      const trackRemoteWrite = (
        operation: () => Promise<void>,
        fallbackMessage: string,
      ) => {
        if (!cloudActive()) return;
        set((s) => ({
          remoteWritePending: s.remoteWritePending + 1,
          remoteWriteError: null,
        }));
        void operation()
          .catch((error) => {
            set({
              remoteWriteError:
                error instanceof Error ? error.message : fallbackMessage,
            });
          })
          .finally(() => {
            set((s) => ({
              remoteWritePending: Math.max(0, s.remoteWritePending - 1),
            }));
          });
      };

      return {
      assets: SAMPLE_ASSETS,
      transactions: SAMPLE_TXNS,
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      censored: false,
      modelPortfolio: [],
      remoteWritePending: 0,
      remoteWriteError: null,
      localDataWarning: null,

      setHydrated: () =>
        set((s) => ({
          hydrated: true,
          settings: sanitizeSettings(s.settings),
          remoteWritePending: 0,
          remoteWriteError: null,
        })),
      clearRemoteWriteError: () => set({ remoteWriteError: null }),
      clearLocalDataWarning: () => set({ localDataWarning: null }),
      setLocalDataWarning: (warning) => set({ localDataWarning: warning }),
      retryRemoteSync: () => {
        const state = get();
        const validationError = validateReplacement({
          assets: state.assets,
          transactions: state.transactions,
          settings: state.settings,
          modelPortfolio: state.modelPortfolio,
        });
        if (validationError) {
          const error = `Cannot retry cloud sync because local data is invalid. ${validationError}`;
          set({ remoteWriteError: error });
          return { ok: false, error };
        }
        if (!cloudActive()) {
          const error = "Cloud is not connected. Sign in again before retrying sync.";
          set({ remoteWriteError: error });
          return { ok: false, error };
        }

        trackRemoteWrite(
          () =>
            replaceRemotePortfolio(
              state.assets,
              state.transactions,
              state.settings,
            ),
          "Cloud sync retry failed.",
        );
        return { ok: true };
      },
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
        trackRemoteWrite(() => pushAsset(asset), "Cloud asset save failed.");
        return id;
      },

      addTransaction: (assetId, txn) => get().addTransactions([{ assetId, txn }]),

      addTransactions: (entries) => {
        const state = get();
        const nextTransactions = [...state.transactions];
        const created: Transaction[] = [];

        for (const entry of entries) {
          const asset = state.assets.find((a) => a.id === entry.assetId);
          if (!asset) return { ok: false, error: "Asset not found." };

          const t: Transaction = {
            id: "t-" + uid(),
            assetId: entry.assetId,
            side: entry.txn.side,
            quantity: entry.txn.quantity,
            price: entry.txn.price,
            fee: entry.txn.fee ?? 0,
            date: entry.txn.date ?? localIsoDate(),
            note: entry.txn.note,
            settlementId: entry.txn.settlementId,
            cashFlowType: entry.txn.cashFlowType,
            incomeCategory: entry.txn.incomeCategory,
            incomeAssetId: entry.txn.incomeAssetId,
            withholdingTax: entry.txn.withholdingTax,
            margin: entry.txn.margin,
            leverage: entry.txn.leverage,
          };

          const error = validateTransaction(asset, nextTransactions, t);
          if (error) return { ok: false, error };

          nextTransactions.push(t);
          created.push(t);
        }

        const portfolioError = validateReplacement({
          assets: state.assets,
          transactions: nextTransactions,
          settings: state.settings,
          modelPortfolio: state.modelPortfolio,
        });
        if (portfolioError) return { ok: false, error: portfolioError };

        set({ transactions: nextTransactions });
        trackRemoteWrite(
          () =>
            Promise.all(created.map((transaction) => pushTransaction(transaction)))
              .then(() => undefined),
          "Cloud transaction save failed.",
        );
        return { ok: true, transactions: created };
      },

      addAssetTransactions: (entries) => {
        const state = get();
        const nextAssets = [...state.assets];
        const nextTransactions = [...state.transactions];
        const createdAssets: Asset[] = [];
        const createdTransactions: Transaction[] = [];

        for (const entry of entries) {
          let asset = nextAssets.find(
            (a) =>
              a.quoteId === entry.asset.quoteId &&
              a.type === entry.asset.type,
          );

          if (!asset) {
            asset = { id: "a-" + uid(), ...entry.asset };
            const assetError = validateAsset(asset);
            if (assetError) return { ok: false, error: assetError };
            nextAssets.push(asset);
            createdAssets.push(asset);
          }

          const transaction: Transaction = {
            id: "t-" + uid(),
            assetId: asset.id,
            side: entry.txn.side,
            quantity: entry.txn.quantity,
            price: entry.txn.price,
            fee: entry.txn.fee ?? 0,
            date: entry.txn.date ?? localIsoDate(),
            note: entry.txn.note,
            settlementId: entry.txn.settlementId,
            cashFlowType: entry.txn.cashFlowType,
            incomeCategory: entry.txn.incomeCategory,
            incomeAssetId: entry.txn.incomeAssetId,
            withholdingTax: entry.txn.withholdingTax,
            margin: entry.txn.margin,
            leverage: entry.txn.leverage,
          };

          const transactionError = validateTransaction(
            asset,
            nextTransactions,
            transaction,
          );
          if (transactionError) return { ok: false, error: transactionError };

          nextTransactions.push(transaction);
          createdTransactions.push(transaction);
        }

        const portfolioError = validateReplacement({
          assets: nextAssets,
          transactions: nextTransactions,
          settings: state.settings,
          modelPortfolio: state.modelPortfolio,
        });
        if (portfolioError) return { ok: false, error: portfolioError };

        set({ assets: nextAssets, transactions: nextTransactions });
        trackRemoteWrite(
          async () => {
            for (const asset of createdAssets) {
              await pushAsset(asset);
            }
            for (const transaction of createdTransactions) {
              await pushTransaction(transaction);
            }
          },
          "Cloud transaction save failed.",
        );
        return { ok: true, transactions: createdTransactions };
      },

      deleteTransaction: (id) => get().deleteTransactions([id]),

      deleteTransactions: (ids) => {
        const deleteIds = new Set(ids);
        if (deleteIds.size === 0) return { ok: true };

        const state = get();
        const nextTransactions = state.transactions.filter(
          (t) => !deleteIds.has(t.id),
        );
        if (nextTransactions.length === state.transactions.length) {
          return { ok: false, error: "Transaction not found." };
        }

        const error = validateReplacement({
          assets: state.assets,
          transactions: nextTransactions,
          settings: state.settings,
          modelPortfolio: state.modelPortfolio,
        });
        if (error) {
          return {
            ok: false,
            error: `Cannot delete because the remaining history would be invalid. ${error}`,
          };
        }

        set({ transactions: nextTransactions });
        trackRemoteWrite(
          () => deleteTransactionsRemote([...deleteIds]),
          "Cloud transaction delete failed.",
        );
        return { ok: true };
      },

      updateSettings: (patch) => {
        const next = { ...get().settings, ...patch };
        const error = validateSettingsPatch(next);
        if (error) return { ok: false, error };
        set({ settings: next });
        trackRemoteWrite(() => pushSettings(next), "Cloud settings save failed.");
        return { ok: true };
      },

      resetSample: () => {
        const settings = get().settings;
        set({
          assets: SAMPLE_ASSETS,
          transactions: SAMPLE_TXNS,
          modelPortfolio: [],
        });
        trackRemoteWrite(
          () => replaceRemotePortfolio(SAMPLE_ASSETS, SAMPLE_TXNS, settings),
          "Cloud demo reset failed.",
        );
      },

      clearAll: () => {
        set({ assets: [], transactions: [], modelPortfolio: [] });
        trackRemoteWrite(
          () => clearRemotePortfolio(),
          "Cloud portfolio clear failed.",
        );
      },

      replaceAll: ({ assets, transactions, settings, modelPortfolio }) => {
        const state = get();
        const nextSettings = settings
          ? { ...state.settings, ...settings }
          : sanitizeSettings(state.settings);
        const error = validateReplacement({
          assets,
          transactions,
          settings: nextSettings,
          modelPortfolio,
        });
        if (error) return { ok: false, error };

        set((s) => ({
          assets,
          transactions,
          settings: nextSettings,
          modelPortfolio: modelPortfolio ?? s.modelPortfolio,
        }));
        return { ok: true };
      },
    };
    },
    {
      name: "folio-store-v1",
      storage: createJSONStorage(getFolioStorage),
      partialize: (state) => ({
        assets: state.assets,
        transactions: state.transactions,
        settings: state.settings,
        censored: state.censored,
        modelPortfolio: state.modelPortfolio,
      }),
      merge: mergePersistedState,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          state?.setLocalDataWarning(
            "Saved browser data could not be parsed. Folio loaded the built-in sample portfolio instead.",
          );
        } else if (storageFallbackWarning) {
          state?.setLocalDataWarning(storageFallbackWarning);
        }
        state?.setHydrated();
      },
    },
  ),
);
