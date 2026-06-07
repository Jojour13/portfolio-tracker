import {
  ASSET_TYPES,
  CURRENCIES,
  type Asset,
  type Currency,
  type IncomeCategory,
  type ModelHolding,
  type Settings,
  type Transaction,
} from "./types";
import { validateSettingsPatch } from "./settings";

const EPSILON = 1e-9;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency);
}

function isAssetType(value: unknown): value is Asset["type"] {
  return typeof value === "string" && ASSET_TYPES.includes(value as Asset["type"]);
}

function isCashFlowType(value: unknown) {
  return (
    value === "external" ||
    value === "income" ||
    value === "transfer" ||
    value === "settlement"
  );
}

function isIncomeCategory(value: unknown): value is IncomeCategory {
  return (
    value === "dividend" ||
    value === "interest" ||
    value === "reward" ||
    value === "other"
  );
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function quantityThroughDate(
  transactions: Transaction[],
  assetId: string,
  throughDate: string,
) {
  return transactions
    .filter((t) => t.assetId === assetId && t.date <= throughDate)
    .reduce((q, t) => q + (t.side === "buy" ? t.quantity : -t.quantity), 0);
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(EPSILON, Math.abs(b) * 1e-8);
}

export function validateAsset(asset: Asset, label = "Asset") {
  if (!isNonEmptyString(asset.id)) return `${label} id is missing.`;
  if (!isAssetType(asset.type)) {
    return `${label} ${asset.id} has an invalid type.`;
  }
  if (!isNonEmptyString(asset.symbol)) {
    return `${label} ${asset.id} has an invalid symbol.`;
  }
  if (!isNonEmptyString(asset.name)) {
    return `${label} ${asset.id} has an invalid name.`;
  }
  if (!isCurrency(asset.currency)) {
    return `${label} ${asset.id} has an invalid currency.`;
  }
  if (
    asset.type === "cash"
      ? asset.quoteSource !== "cash"
      : asset.quoteSource !== "coingecko" && asset.quoteSource !== "yahoo"
  ) {
    return `${label} ${asset.id} has an invalid quote source.`;
  }
  if (!isNonEmptyString(asset.quoteId)) {
    return `${label} ${asset.id} has an invalid quote id.`;
  }
  if (
    asset.type === "cash" &&
    asset.quoteId !== `cash-${asset.currency.toLowerCase()}`
  ) {
    return `${label} ${asset.id} cash quote id must match its currency.`;
  }
  if (asset.type === "cash" && asset.symbol !== asset.currency) {
    return `${label} ${asset.id} cash symbol must match its currency.`;
  }
  if (!isFiniteNumber(asset.lotSize) || asset.lotSize <= 0) {
    return `${label} ${asset.id} has an invalid lot size.`;
  }
  return null;
}

export function isAsset(value: unknown): value is Asset {
  return isRecord(value) && validateAsset(value as unknown as Asset) === null;
}

export function isTransaction(value: unknown): value is Transaction {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.assetId) &&
    (value.side === "buy" || value.side === "sell") &&
    isFiniteNumber(value.quantity) &&
    value.quantity > 0 &&
    isFiniteNumber(value.price) &&
    value.price > 0 &&
    isFiniteNumber(value.fee) &&
    value.fee >= 0 &&
    isLocalDate(value.date) &&
    (value.note === undefined || typeof value.note === "string") &&
    (value.settlementId === undefined || isNonEmptyString(value.settlementId)) &&
    (value.cashFlowType === undefined || isCashFlowType(value.cashFlowType)) &&
    (value.incomeCategory === undefined ||
      isIncomeCategory(value.incomeCategory)) &&
    (value.incomeAssetId === undefined || isNonEmptyString(value.incomeAssetId)) &&
    (value.withholdingTax === undefined ||
      (isFiniteNumber(value.withholdingTax) && value.withholdingTax >= 0)) &&
    (value.margin === undefined || typeof value.margin === "boolean") &&
    (value.leverage === undefined ||
      (isFiniteNumber(value.leverage) && value.leverage >= 1))
  );
}

export function validateTransactionFields(asset: Asset, txn: Transaction) {
  if (!isNonEmptyString(txn.id)) return "Transaction id is missing.";
  if (!isNonEmptyString(txn.assetId)) return `Transaction ${txn.id} has no asset.`;
  if (txn.side !== "buy" && txn.side !== "sell") {
    return `Transaction ${txn.id} has an invalid side.`;
  }
  if (!isLocalDate(txn.date)) return `Transaction ${txn.id} has an invalid date.`;
  if (!isFiniteNumber(txn.quantity) || txn.quantity <= 0) {
    return `Transaction ${txn.id} quantity must be greater than zero.`;
  }
  if (!isFiniteNumber(txn.price) || txn.price <= 0) {
    return `Transaction ${txn.id} price must be greater than zero.`;
  }
  if (!isFiniteNumber(txn.fee) || txn.fee < 0) {
    return `Transaction ${txn.id} fee must be zero or greater.`;
  }
  if (asset.type === "cash" && Math.abs(txn.price - 1) > EPSILON) {
    return `Transaction ${txn.id} is a cash row but does not use price 1.`;
  }
  if (txn.note !== undefined && typeof txn.note !== "string") {
    return `Transaction ${txn.id} has an invalid note.`;
  }
  if (txn.settlementId !== undefined && !isNonEmptyString(txn.settlementId)) {
    return `Transaction ${txn.id} has an invalid settlement id.`;
  }
  if (txn.cashFlowType !== undefined && !isCashFlowType(txn.cashFlowType)) {
    return `Transaction ${txn.id} has an invalid cash-flow type.`;
  }
  if (txn.cashFlowType !== undefined && asset.type !== "cash") {
    return `Transaction ${txn.id} can only use cash-flow type on cash rows.`;
  }
  if (txn.incomeCategory !== undefined && !isIncomeCategory(txn.incomeCategory)) {
    return `Transaction ${txn.id} has an invalid income category.`;
  }
  if (txn.incomeAssetId !== undefined && !isNonEmptyString(txn.incomeAssetId)) {
    return `Transaction ${txn.id} has an invalid income source asset.`;
  }
  if (
    txn.withholdingTax !== undefined &&
    (!isFiniteNumber(txn.withholdingTax) || txn.withholdingTax < 0)
  ) {
    return `Transaction ${txn.id} withholding tax must be zero or greater.`;
  }
  if (
    (txn.incomeCategory !== undefined ||
      txn.incomeAssetId !== undefined ||
      txn.withholdingTax !== undefined) &&
    txn.cashFlowType !== "income"
  ) {
    return `Transaction ${txn.id} can only use income metadata on income cash flows.`;
  }
  if (asset.type === "cash") {
    if (txn.cashFlowType === "income" && txn.side !== "buy") {
      return `Transaction ${txn.id} income cash flow must be a deposit.`;
    }
    if (txn.cashFlowType === "settlement" && !txn.settlementId) {
      return `Transaction ${txn.id} settlement cash flow must link to a settlement group.`;
    }
    if (txn.cashFlowType === "transfer" && !txn.settlementId) {
      return `Transaction ${txn.id} transfer cash flow must link to a transfer group.`;
    }
    if (
      txn.settlementId &&
      txn.cashFlowType !== undefined &&
      txn.cashFlowType !== "settlement" &&
      txn.cashFlowType !== "transfer"
    ) {
      return `Transaction ${txn.id} grouped cash row cannot be marked as ${txn.cashFlowType}.`;
    }
  }
  if (txn.margin !== undefined && typeof txn.margin !== "boolean") {
    return `Transaction ${txn.id} has an invalid margin flag.`;
  }
  if (
    txn.leverage !== undefined &&
    (!isFiniteNumber(txn.leverage) || txn.leverage < 1)
  ) {
    return `Transaction ${txn.id} leverage must be 1x or greater.`;
  }
  return null;
}

export function validateTransaction(
  asset: Asset,
  existingTransactions: Transaction[],
  txn: Transaction,
) {
  const fieldError = validateTransactionFields(asset, txn);
  if (fieldError) return fieldError;
  if (txn.side === "sell") {
    const available = quantityThroughDate(existingTransactions, asset.id, txn.date);
    if (txn.quantity > available + EPSILON) {
      const action = asset.type === "cash" ? "withdraw" : "sell";
      return `Cannot ${action} more ${asset.symbol} than available on ${txn.date}.`;
    }
  }
  return null;
}

export function validateModelHolding(holding: ModelHolding) {
  const assetError = validateAsset(holding, "Model holding");
  if (assetError) return assetError;
  if (!isFiniteNumber(holding.qty) || holding.qty < 0) {
    return `Model holding ${holding.id} has an invalid quantity.`;
  }
  return null;
}

export function isModelHolding(value: unknown): value is ModelHolding {
  return (
    isAsset(value) &&
    isRecord(value) &&
    isFiniteNumber(value.qty) &&
    value.qty >= 0
  );
}

export function firstDuplicateId(items: { id: string }[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) return item.id;
    seen.add(item.id);
  }
  return null;
}

function firstDuplicateAssetIdentity(items: Asset[]) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.type}:${item.quoteId}`;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

export function firstSettlementIssue(
  assets: Asset[],
  transactions: Transaction[],
) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (!transaction.settlementId) continue;
    const group = groups.get(transaction.settlementId) ?? [];
    group.push(transaction);
    groups.set(transaction.settlementId, group);
  }

  for (const [settlementId, group] of groups) {
    if (group.length !== 2) {
      return `Settlement group ${settlementId} must contain exactly 2 transactions.`;
    }

    const rows = group.map((transaction) => ({
      transaction,
      asset: assetById.get(transaction.assetId),
    }));
    const cashRows = rows.filter((row) => row.asset?.type === "cash");
    const tradeRows = rows.filter((row) => row.asset && row.asset.type !== "cash");

    if (
      cashRows.length === 2 &&
      tradeRows.length === 0 &&
      cashRows.every((row) => row.transaction.cashFlowType === "transfer")
    ) {
      const [first, second] = cashRows;
      if (first.transaction.date !== second.transaction.date) {
        return `Transfer group ${settlementId} must use one shared date.`;
      }
      if (first.transaction.side === second.transaction.side) {
        return `Transfer group ${settlementId} must contain one withdrawal and one deposit.`;
      }
      if (first.asset!.currency === second.asset!.currency) {
        return `Transfer group ${settlementId} must move between two currencies.`;
      }
      if (
        Math.abs(first.transaction.price - 1) > EPSILON ||
        Math.abs(second.transaction.price - 1) > EPSILON ||
        Math.abs(first.transaction.fee) > EPSILON ||
        Math.abs(second.transaction.fee) > EPSILON
      ) {
        return `Transfer group ${settlementId} cash rows must use price 1 and zero fee.`;
      }
      continue;
    }

    if (cashRows.length !== 1 || tradeRows.length !== 1) {
      return `Settlement group ${settlementId} must link one trade row and one cash row.`;
    }

    const cash = cashRows[0].transaction;
    const cashAsset = cashRows[0].asset!;
    const trade = tradeRows[0].transaction;
    const tradeAsset = tradeRows[0].asset!;
    if (cash.date !== trade.date) {
      return `Settlement group ${settlementId} must use one shared date.`;
    }

    const expectedCashSide = trade.side === "buy" ? "sell" : "buy";
    if (cash.side !== expectedCashSide) {
      return `Settlement group ${settlementId} has the wrong cash direction.`;
    }
    if (cashAsset.currency !== tradeAsset.currency) {
      return `Settlement group ${settlementId} cash currency must match ${tradeAsset.symbol}.`;
    }
    if (Math.abs(cash.price - 1) > EPSILON || Math.abs(cash.fee) > EPSILON) {
      return `Settlement group ${settlementId} cash row must use price 1 and zero fee.`;
    }
    if (cash.cashFlowType !== "settlement") {
      return `Settlement group ${settlementId} cash row must be marked as settlement.`;
    }
    const marginBuy =
      trade.side === "buy" &&
      trade.margin === true &&
      typeof trade.leverage === "number" &&
      trade.leverage > 1;
    const tradeGross = trade.quantity * trade.price;
    const expectedCashAmount =
      trade.side === "buy"
        ? (tradeGross + trade.fee) / (marginBuy ? trade.leverage! : 1)
        : tradeGross - trade.fee;
    if (!nearlyEqual(cash.quantity, expectedCashAmount)) {
      return `Settlement group ${settlementId} cash amount must match the linked trade settlement.`;
    }
  }

  return null;
}

export function firstChronologyIssue(
  assets: Asset[],
  transactions: Transaction[],
) {
  for (const asset of assets) {
    const ordered = transactions
      .map((transaction, index) => ({ transaction, index }))
      .filter(({ transaction }) => transaction.assetId === asset.id)
      .sort(
        (a, b) =>
          a.transaction.date.localeCompare(b.transaction.date) || a.index - b.index,
      );

    let quantity = 0;
    for (const { transaction } of ordered) {
      if (transaction.side === "buy") {
        quantity += transaction.quantity;
        continue;
      }
      if (transaction.quantity > quantity + EPSILON) {
        const action = asset.type === "cash" ? "withdrawal" : "sell";
        return `Transaction ${transaction.id} would make ${asset.symbol} ${action} quantity negative on ${transaction.date}.`;
      }
      quantity -= transaction.quantity;
      if (Math.abs(quantity) <= EPSILON) quantity = 0;
    }
  }
  return null;
}

export function validateReplacement(data: {
  assets: Asset[];
  transactions: Transaction[];
  settings?: Partial<Settings>;
  modelPortfolio?: ModelHolding[];
}) {
  const duplicateAssetId = firstDuplicateId(data.assets);
  if (duplicateAssetId) return `Duplicate asset id: ${duplicateAssetId}.`;
  const duplicateTransactionId = firstDuplicateId(data.transactions);
  if (duplicateTransactionId) {
    return `Duplicate transaction id: ${duplicateTransactionId}.`;
  }
  if (data.modelPortfolio) {
    const duplicateModelId = firstDuplicateId(data.modelPortfolio);
    if (duplicateModelId) return `Duplicate model holding id: ${duplicateModelId}.`;
  }

  const assetById = new Map<string, Asset>();
  for (const asset of data.assets) {
    const error = validateAsset(asset);
    if (error) return error;
    assetById.set(asset.id, asset);
  }
  const duplicateAssetIdentity = firstDuplicateAssetIdentity(data.assets);
  if (duplicateAssetIdentity) {
    return `Duplicate asset identity: ${duplicateAssetIdentity}.`;
  }

  for (const transaction of data.transactions) {
    const asset = assetById.get(transaction.assetId);
    if (!asset) {
      return `Transaction ${transaction.id} references a missing asset.`;
    }
    const error = validateTransactionFields(asset, transaction);
    if (error) return error;
    if (transaction.incomeAssetId) {
      const incomeAsset = assetById.get(transaction.incomeAssetId);
      if (!incomeAsset) {
        return `Transaction ${transaction.id} references a missing income source asset.`;
      }
      if (incomeAsset.type === "cash") {
        return `Transaction ${transaction.id} income source must be a non-cash asset.`;
      }
    }
  }

  for (const holding of data.modelPortfolio ?? []) {
    const error = validateModelHolding(holding);
    if (error) return error;
  }
  const duplicateModelIdentity = data.modelPortfolio
    ? firstDuplicateAssetIdentity(data.modelPortfolio)
    : null;
  if (duplicateModelIdentity) {
    return `Duplicate model holding identity: ${duplicateModelIdentity}.`;
  }

  const settingsError = validateSettingsPatch(data.settings);
  if (settingsError) return settingsError;
  return firstSettlementIssue(data.assets, data.transactions) ??
    firstChronologyIssue(data.assets, data.transactions);
}
