"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  LogOut,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/add", label: "Add", icon: PlusCircle },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const { enabled, user, syncing, signOut } = useAuth();

  return (
    <>
      {/* Desktop / tablet: sidebar-ish top rail */}
      <nav className="sticky top-0 z-30 hidden border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3">
          <Link href="/" className="mr-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 font-bold text-white">
              ƒ
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              Folio
            </span>
          </Link>
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}

          {enabled && user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Cloud
                  size={14}
                  className={syncing ? "animate-pulse text-amber-400" : "text-emerald-400"}
                />
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                title="Sign out"
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-rose-300"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-indigo-400" : "text-zinc-500",
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
