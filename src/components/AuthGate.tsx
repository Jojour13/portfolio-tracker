"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_PATHS = ["/login", "/reset"];

/**
 * When cloud sync is configured, require a signed-in session to view the app.
 * When it isn't (no Supabase env), the app stays fully local and this is a
 * transparent pass-through.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { enabled, user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!enabled || loading) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [enabled, user, loading, isPublic, pathname, router]);

  if (enabled && loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (enabled && !user && !isPublic) {
    return null; // redirecting to /login
  }

  return <>{children}</>;
}
