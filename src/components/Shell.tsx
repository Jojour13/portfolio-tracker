"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";
import { AuthGate } from "./AuthGate";

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
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-10">
        <AuthGate>{children}</AuthGate>
      </main>
    </>
  );
}
