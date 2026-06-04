import { AddTransactionForm } from "@/components/AddTransactionForm";

export default function AddPage() {
  return (
    <div className="animate-fade mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Add transaction
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Buy or sell crypto, stocks, or record a cash balance. Your average
          cost updates automatically.
        </p>
      </div>
      <AddTransactionForm />
    </div>
  );
}
