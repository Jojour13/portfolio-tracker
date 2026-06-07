"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isCloudEnabled } from "./supabase/client";
import {
  activateCloud,
  deactivateCloud,
  pullAll,
  pushAll,
} from "./cloud";
import { clearLocalOnlyPlanSettings, DEFAULT_SETTINGS } from "./settings";
import { isBuiltInSamplePortfolio, useFolio } from "./store";
import { validateReplacement } from "./portfolioValidation";

interface AuthValue {
  /** Whether cloud sync is configured at all (env vars present). */
  enabled: boolean;
  user: User | null;
  loading: boolean;
  syncing: boolean;
  syncError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isCloudEnabled);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const replaceAll = useFolio((s) => s.replaceAll);
  const lastUserId = useRef<string | null>(null);

  // Pull the user's portfolio from the cloud once they're signed in.
  async function syncDown(session: Session) {
    const sb = getSupabase();
    if (!sb) return;
    activateCloud(sb, session.user.id);
    setSyncing(true);
    setSyncError(null);
    try {
      const data = await pullAll();
      if (data) {
        const local = useFolio.getState();
        const remoteEmpty = data.assets.length === 0 && data.transactions.length === 0;
        const localHasPortfolio =
          local.assets.length > 0 ||
          local.transactions.length > 0;
        const localIsDemo = isBuiltInSamplePortfolio(
          local.assets,
          local.transactions,
          local.modelPortfolio,
        );

        if (remoteEmpty && localHasPortfolio) {
          if (local.localDataWarning || localIsDemo) {
            const result = replaceAll({
              assets: [],
              transactions: [],
              settings: clearLocalOnlyPlanSettings(data.settings),
              modelPortfolio: [],
            });
            if (!result.ok) {
              setSyncError(`Cloud sync skipped: ${result.error}`);
            } else if (local.localDataWarning) {
              setSyncError(
                "Cloud sync did not seed remote data because saved local data failed validation. Restore a known-good backup from Settings if needed.",
              );
            }
            return;
          }
          const validationError = validateReplacement({
            assets: local.assets,
            transactions: local.transactions,
            settings: local.settings,
            modelPortfolio: local.modelPortfolio,
          });
          if (validationError) {
            setSyncError(`Cloud seed skipped: ${validationError}`);
            return;
          }
          await pushAll(local.assets, local.transactions, local.settings);
          return;
        }

        const result = replaceAll({
          assets: data.assets,
          transactions: data.transactions,
          settings: clearLocalOnlyPlanSettings(data.settings),
          modelPortfolio: [],
        });
        if (!result.ok) {
          setSyncError(`Cloud sync skipped: ${result.error}`);
        }
      }
    } catch (error) {
      setSyncError(
        error instanceof Error ? `Cloud sync failed: ${error.message}` : "Cloud sync failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setUser(data.session.user);
        lastUserId.current = data.session.user.id;
        await syncDown(data.session);
      }
      setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (session && session.user.id !== lastUserId.current) {
        lastUserId.current = session.user.id;
        void syncDown(session);
      } else if (!session) {
        lastUserId.current = null;
        setSyncError(null);
        deactivateCloud();
        // clear the in-memory view on logout (privacy on shared devices)
        replaceAll({
          assets: [],
          transactions: [],
          settings: clearLocalOnlyPlanSettings(DEFAULT_SETTINGS),
          modelPortfolio: [],
        });
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      enabled: isCloudEnabled,
      user,
      loading,
      syncing,
      syncError,
      async signIn(email, password) {
        const sb = getSupabase();
        if (!sb) return { error: "Cloud not configured" };
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return { error: error?.message };
      },
      async signUp(email, password) {
        const sb = getSupabase();
        if (!sb) return { error: "Cloud not configured" };
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) return { error: error.message };
        // If email confirmation is on, there's no active session yet.
        return { needsConfirm: !data.session };
      },
      async signOut() {
        const sb = getSupabase();
        await sb?.auth.signOut();
      },
      async sendReset(email) {
        const sb = getSupabase();
        if (!sb) return { error: "Cloud not configured" };
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/reset`
            : undefined;
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        return { error: error?.message };
      },
      async updatePassword(password) {
        const sb = getSupabase();
        if (!sb) return { error: "Cloud not configured" };
        const { error } = await sb.auth.updateUser({ password });
        return { error: error?.message };
      },
    }),
    [user, loading, syncing, syncError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
