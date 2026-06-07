"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  LogOut,
  Upload,
} from "lucide-react";
import { useFolio } from "@/lib/store";
import { CURRENCIES, type Currency } from "@/lib/types";
import { Card, Label, Select, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { localIsoDate } from "@/lib/utils";
import { readSettingsResult } from "@/lib/settings";
import {
  isAsset,
  isModelHolding,
  isTransaction,
  validateReplacement,
} from "@/lib/portfolioValidation";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ImportStatus = {
  tone: "success" | "error";
  message: string;
};

export default function SettingsPage() {
  const hydrated = useFolio((s) => s.hydrated);
  const assets = useFolio((s) => s.assets);
  const transactions = useFolio((s) => s.transactions);
  const settings = useFolio((s) => s.settings);
  const modelPortfolio = useFolio((s) => s.modelPortfolio);
  const updateSettings = useFolio((s) => s.updateSettings);
  const resetSample = useFolio((s) => s.resetSample);
  const clearAll = useFolio((s) => s.clearAll);
  const replaceAll = useFolio((s) => s.replaceAll);
  const retryRemoteSync = useFolio((s) => s.retryRemoteSync);
  const { enabled, user, signOut, syncError } = useAuth();
  const importRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);

  function exportBackup() {
    downloadJson(`folio-backup-${localIsoDate()}.json`, {
      app: "folio",
      version: 1,
      exportedAt: new Date().toISOString(),
      assets,
      transactions,
      settings,
      modelPortfolio,
    });
  }

  async function importBackup(file: File | null) {
    if (!file) return;
    setImportStatus(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isRecord(parsed)) throw new Error("Backup must be a JSON object.");

      const importedAssets = parsed.assets;
      const importedTransactions = parsed.transactions;
      const settingsResult = readSettingsResult(parsed.settings);
      const importedModel = parsed.modelPortfolio;

      if (!Array.isArray(importedAssets) || !importedAssets.every(isAsset)) {
        throw new Error("Backup assets are missing or invalid.");
      }
      if (
        !Array.isArray(importedTransactions) ||
        !importedTransactions.every(isTransaction)
      ) {
        throw new Error("Backup transactions are missing or invalid.");
      }
      if (!settingsResult.ok) throw new Error(settingsResult.error);
      if (
        importedModel !== undefined &&
        (!Array.isArray(importedModel) || !importedModel.every(isModelHolding))
      ) {
        throw new Error("Backup model portfolio is invalid.");
      }

      const importedModelPortfolio = Array.isArray(importedModel)
        ? importedModel
        : [];
      const importedSettings = settingsResult.settings;
      const replacementError = validateReplacement({
        assets: importedAssets,
        transactions: importedTransactions,
        settings: importedSettings,
        modelPortfolio: importedModelPortfolio,
      });
      if (replacementError) throw new Error(replacementError);

      const ok = confirm(
        `Restore ${importedAssets.length} assets and ${importedTransactions.length} transactions from this backup? This replaces the local portfolio in this browser.`,
      );
      if (!ok) return;

      const result = replaceAll({
        assets: importedAssets,
        transactions: importedTransactions,
        settings: importedSettings,
        modelPortfolio: importedModelPortfolio,
      });
      if (!result.ok) throw new Error(result.error);
      if (enabled && user) {
        const syncResult = retryRemoteSync();
        if (!syncResult.ok) {
          setImportStatus({
            tone: "error",
            message: `Backup restored locally, but cloud replacement could not start: ${syncResult.error}`,
          });
          return;
        }
      }
      setImportStatus({
        tone: "success",
        message: `Backup restored${enabled && user ? " and cloud replacement queued" : " locally"}: ${importedAssets.length} assets, ${importedTransactions.length} transactions, and ${importedModelPortfolio.length} model holdings.`,
      });
    } catch (error) {
      setImportStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not import backup.",
      });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

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
            indicative FX rates. If the FX provider is unavailable, Folio shows
            approximate fallback rates and flags that on the dashboard.
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

      {enabled && user && (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            <Cloud size={15} className="text-emerald-400" /> Account
          </h2>
          <p className="text-sm text-zinc-200">{user.email}</p>
          <p className="text-xs text-zinc-500">
            Cloud sync is active for supported portfolio data. Local changes
            appear immediately; Folio warns you if a remote write fails.
          </p>
          {syncError && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {syncError} Your local portfolio was left unchanged.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut size={14} /> Sign out
          </Button>
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-medium text-zinc-300">Data</h2>
        <p className="text-xs text-zinc-500">
          {enabled
            ? "Holdings, transactions, base currency, and refresh interval sync to your Supabase account with row-level security. Targets, risk assumptions, and model portfolios are local-only unless you export a backup."
            : "Your portfolio is saved locally in this browser. Anyone with this browser profile can access it; connect Supabase (see README) to sync across devices."}
          {enabled && user
            ? " Backup restore replaces local browser data and queues a cloud replacement."
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportBackup}>
            <Download size={14} /> Download backup
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void importBackup(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={14} /> Restore backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "This REPLACES your current holdings, transactions, and model portfolio with demo data. If cloud sync is connected, the remote rows are replaced too. Download a backup first if you need one. Continue?",
                )
              )
                resetSample();
            }}
          >
            Load demo data
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "Delete all holdings, transactions, and model portfolio rows? If cloud sync is connected, remote rows are cleared too. Download a backup first if you need one.",
                )
              )
                clearAll();
            }}
          >
            Clear everything
          </Button>
        </div>
        {importStatus && (
          <div
            role={importStatus.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              importStatus.tone === "error"
                ? "flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                : "flex gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
            }
          >
            {importStatus.tone === "error" ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-zinc-600">Folio v0.1 · ƒ</p>
    </div>
  );
}
