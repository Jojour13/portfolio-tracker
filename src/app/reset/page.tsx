"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, Input, Button, Label } from "@/components/ui";

export default function ResetPage() {
  const { enabled, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) setError(error);
    else {
      setDone(true);
      setTimeout(() => router.replace("/"), 1200);
    }
  }

  return (
    <div className="animate-fade space-y-5">
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-xl font-bold text-white">
          <ShieldCheck size={22} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Set a new password
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a new password for your account.
        </p>
      </div>

      <Card className="p-6">
        {done ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-300">
            Password updated. Redirecting…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>New password</Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  className="pl-9"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {!enabled && (
              <p className="text-xs text-zinc-500">
                Open this page from the reset link in your email.
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <Button className="w-full" disabled={busy} type="submit">
              {busy && <Loader2 size={16} className="animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
