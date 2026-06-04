"use client";

import { Cloud, LogOut } from "lucide-react";
import { useFolio } from "@/lib/store";
import { CURRENCIES, type Currency } from "@/lib/types";
import { Card, Label, Select, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { RiskQuiz } from "@/components/RiskQuiz";
import { AllocationDesigner } from "@/components/AllocationDesigner";

export default function SettingsPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const settings = useFolio((s) => s.settings);
  const updateSettings = useFolio((s) => s.updateSettings);
  const resetSample = useFolio((s) => s.resetSample);
  const clearAll = useFolio((s) => s.clearAll);
  const { enabled, user, signOut } = useAuth();

  if (!hydrated)
    return <div className="py-20 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="animate-fade mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Base currency</Label>
          <Select
            value={settings.baseCurrency}
            onChange={(e) =>
              updateSettings({ baseCurrency: e.target.value as Currency })
            }
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-zinc-500">
            Everything in the pie and totals is converted to this currency at
            live FX rates.
          </p>
        </div>

        <div>
          <Label>Price refresh interval</Label>
          <Select
            value={settings.refreshIntervalSec}
            onChange={(e) =>
              updateSettings({ refreshIntervalSec: Number(e.target.value) })
            }
          >
            <option value={15}>Every 15 seconds</option>
            <option value={30}>Every 30 seconds</option>
            <option value={60}>Every minute</option>
            <option value={300}>Every 5 minutes</option>
          </Select>
        </div>
      </Card>

      <RiskQuiz />

      <AllocationDesigner />

      {enabled && user && (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            <Cloud size={15} className="text-emerald-400" /> Account
          </h2>
          <p className="text-sm text-zinc-200">{user.email}</p>
          <p className="text-xs text-zinc-500">
            Synced to the cloud. Your data follows you across devices.
          </p>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut size={14} /> Sign out
          </Button>
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-medium text-zinc-300">Data</h2>
        <p className="text-xs text-zinc-500">
          {enabled
            ? "Your portfolio is synced to your private cloud account, protected by row-level security."
            : "Your portfolio is saved locally in this browser. Connect Supabase (see README) to sync across devices."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "This REPLACES your current holdings and transactions with sample data. Your real entries will be lost. Continue?",
                )
              )
                resetSample();
            }}
          >
            Load sample portfolio
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm("Delete all holdings and transactions?")) clearAll();
            }}
          >
            Clear everything
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-zinc-600">Folio v0.1 · ƒ</p>
    </div>
  );
}
