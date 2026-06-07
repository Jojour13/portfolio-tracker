import type { Asset, CashFlowType, Transaction } from "./types";

export function cashFlowTypeForTransaction(
  asset: Asset | undefined,
  transaction: Transaction,
): CashFlowType | null {
  if (!asset || asset.type !== "cash") return null;
  if (transaction.cashFlowType) return transaction.cashFlowType;
  if (transaction.settlementId) return "settlement";

  const note = transaction.note?.trim().toLowerCase() ?? "";
  if (note.startsWith("fx ->") || note.startsWith("fx <-")) {
    return transaction.settlementId ? "transfer" : "external";
  }
  if (note.startsWith("fx \u2192") || note.startsWith("fx \u2190")) {
    return transaction.settlementId ? "transfer" : "external";
  }

  return "external";
}

export function isExternalCashFlow(type: CashFlowType | null) {
  return type === "external" || type === "settlement";
}
