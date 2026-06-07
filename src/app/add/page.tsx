import { AddTransactionForm } from "@/components/AddTransactionForm";
import { CashConverter } from "@/components/CashConverter";

export default function AddPage() {
  return (
    <div className="animate-fade mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Add transaction
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Buy or sell crypto, stocks, funds, bond funds, and money market
          instruments with optional cash settlement, or record deposits,
          withdrawals, income, and FX conversions.
        </p>
      </div>
      <AddTransactionForm />
      <CashConverter />
    </div>
  );
}
