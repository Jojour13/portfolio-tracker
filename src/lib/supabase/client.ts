"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns a Supabase browser client, or null when env vars are absent.
 * Folio works fully offline (localStorage) when this is null; once you add
 * NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY it becomes available for cloud sync.
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isCloudEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
