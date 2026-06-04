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
} from "./cloud";
import { useFolio } from "./store";

interface AuthValue {
  /** Whether cloud sync is configured at all (env vars present). */
  enabled: boolean;
  user: User | null;
  loading: boolean;
  syncing: boolean;
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
  const replaceAll = useFolio((s) => s.replaceAll);
  const lastUserId = useRef<string | null>(null);

  // Pull the user's portfolio from the cloud once they're signed in.
  async function syncDown(session: Session) {
    const sb = getSupabase();
    if (!sb) return;
    activateCloud(sb, session.user.id);
    setSyncing(true);
    try {
      const data = await pullAll();
      if (data) {
        replaceAll({
          assets: data.assets,
          transactions: data.transactions,
          settings: data.settings,
        });
      }
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
        deactivateCloud();
        // clear the in-memory view on logout (privacy on shared devices)
        replaceAll({ assets: [], transactions: [] });
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
    [user, loading, syncing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
