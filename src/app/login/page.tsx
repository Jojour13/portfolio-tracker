"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, Input, Button, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const { enabled, signIn, signUp, sendReset } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!enabled) {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-lg font-semibold text-white">Local mode</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Cloud sync isn&apos;t configured, so Folio is running fully on this
          device — no account needed.
        </p>
        <Button className="mt-4 w-full" onClick={() => router.replace("/")}>
          Open Folio
        </Button>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) setError(error);
        else router.replace("/");
      } else if (mode === "signup") {
        const { error, needsConfirm } = await signUp(email, password);
        if (error) setError(error);
        else if (needsConfirm)
          setNotice("Check your email to confirm your account, then sign in.");
        else router.replace("/");
      } else {
        const { error } = await sendReset(email);
        if (error) setError(error);
        else setNotice("If that email exists, a reset link is on its way.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade space-y-5">
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-2xl font-bold text-white">
          ƒ
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white">Folio</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {mode === "signup"
            ? "Create an account to sync across devices"
            : mode === "forgot"
              ? "Reset your password"
              : "Sign in to your portfolio"}
        </p>
      </div>

      <Card className="p-6">
        {mode !== "forgot" && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900/60 p-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  "rounded-lg py-2 text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <Input
                className="pl-9"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {mode !== "forgot" && (
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  className="pl-9"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          )}

          <Button className="w-full" disabled={busy} type="submit">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs">
          {mode === "forgot" ? (
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={() => setMode("signin")}
            >
              ← Back to sign in
            </button>
          ) : (
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setNotice(null);
              }}
            >
              Forgot your password?
            </button>
          )}
        </div>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-600">
        <ShieldCheck size={13} />
        Passwords are hashed — never stored or visible to anyone.
      </p>
    </div>
  );
}
