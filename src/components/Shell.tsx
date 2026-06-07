"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, Loader2, RotateCw, X } from "lucide-react";
import { Nav } from "./Nav";
import { AuthGate } from "./AuthGate";
import { useAuth } from "@/lib/auth-context";
import { useFolio } from "@/lib/store";

const BARE_PATHS = ["/login", "/reset"];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PATHS.includes(pathname);

  if (bare) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full">
          <AuthGate>{children}</AuthGate>
        </div>
      </main>
    );
  }

  return (
    <>
      <Nav />
      <LocalDataBanner />
      <CloudWriteBanner />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-10">
        <AuthGate>{children}</AuthGate>
      </main>
    </>
  );
}

function LocalDataBanner() {
  const warning = useFolio((s) => s.localDataWarning);
  const clearWarning = useFolio((s) => s.clearLocalDataWarning);

  if (!warning) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="border-b border-amber-500/25 bg-amber-500/10"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs text-amber-100 md:px-6">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
        <p className="flex-1">
          Local data recovery: {warning} Restore a known-good backup from
          Settings if this is not the portfolio you expected.
        </p>
        <button
          type="button"
          onClick={clearWarning}
          className="rounded-md p-1 text-amber-100/75 transition hover:bg-amber-400/10 hover:text-amber-50"
          aria-label="Dismiss local data recovery warning"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function CloudWriteBanner() {
  const { enabled, user } = useAuth();
  const pending = useFolio((s) => s.remoteWritePending);
  const error = useFolio((s) => s.remoteWriteError);
  const clearError = useFolio((s) => s.clearRemoteWriteError);
  const retrySync = useFolio((s) => s.retryRemoteSync);

  if (!enabled || !user || (!error && pending === 0)) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      aria-live="polite"
      className={
        error
          ? "border-b border-amber-500/25 bg-amber-500/10"
          : "border-b border-zinc-800 bg-zinc-900/60"
      }
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs md:px-6">
        {error ? (
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
        ) : (
          <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-zinc-400" />
        )}
        <p className={error ? "flex-1 text-amber-100" : "flex-1 text-zinc-400"}>
          {error
            ? `Cloud sync needs attention. Local data is saved in this browser, but the latest remote write did not finish. ${error}`
            : "Saving latest changes to cloud..."}
        </p>
        {error && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Retry cloud sync by replacing remote holdings, transactions, base currency, and refresh interval with this browser's current local data?",
                  )
                ) {
                  retrySync();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 px-2 py-1 font-medium text-amber-50 transition hover:bg-amber-400/10"
            >
              <RotateCw size={13} />
              Retry
            </button>
            <button
              type="button"
              onClick={clearError}
              className="rounded-md p-1 text-amber-100/75 transition hover:bg-amber-400/10 hover:text-amber-50"
              aria-label="Dismiss cloud sync warning"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
