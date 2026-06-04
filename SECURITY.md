# Security & Privacy

Folio is designed so that **your portfolio data and password are yours alone**. This document explains exactly how, and what the guarantees are.

## Passwords

- Authentication is handled by **Supabase Auth**, which stores only a **salted bcrypt hash** of your password — never the plaintext.
- **No one can read your password**: not the app, not the project owner in the Supabase dashboard, and not an attacker who obtains a database dump. A hash cannot be reversed back into the password.
- Minimum length is enforced (8+ characters) and Supabase rate-limits sign-in attempts.

## Forgot password

If you forget your password, use **“Forgot your password?”** on the sign-in screen:

1. You enter your email.
2. Supabase emails a **one-time, time-limited reset link**.
3. The link opens `/reset`, where you choose a new password.

No human is ever in the loop, and the old password is never recoverable (because it was never stored) — it's simply replaced.

## Data isolation (Row-Level Security)

Every table (`assets`, `transactions`, `settings`) has **Row-Level Security** enabled with a policy of `auth.uid() = user_id`. This means:

- Each row is stamped with its owner's user id.
- The database **refuses** any read or write of a row that doesn't belong to the currently-authenticated user.
- This holds even though the `anon` API key is shipped in the client bundle — that key is public *by design* and grants nothing without a valid user session. RLS is the real gatekeeper.

So one user can never see or modify another user's holdings, even by crafting their own API calls.

## What the project owner can/can't see

As the **owner of the Supabase project**, you can query the raw tables in your own dashboard (using the privileged `service_role` key). This is true of essentially every hosted app and is necessary to operate it. It means:

- ✅ Passwords are **never** visible to anyone (they're hashed).
- ⚠️ Holdings data is visible to the project owner at the database level.

### Optional: true zero-knowledge

If you want holdings to be unreadable **even by the project owner**, the path is **client-side (end-to-end) encryption** — encrypt each transaction in the browser with a key derived from the user's password before it's sent to Supabase.

Important tradeoff: this is **incompatible with password reset**. If the encryption key comes from the password and the password is lost, the encrypted data is permanently unrecoverable (a reset can log you in, but can't decrypt old data). This is a deliberate, documented choice for zero-knowledge apps. Folio ships with the standard model (strong hashing + RLS + recoverable accounts) and leaves E2E encryption as an opt-in enhancement.

## Secrets & keys

- Only the **public** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used in the client — safe to expose.
- The privileged `service_role` key is **never** used in Folio and must never be committed or shipped to the browser.
- `.env.local` is git-ignored so your project URL/keys aren't pushed to GitHub.

## Reporting

Found a vulnerability? Open a private security advisory on the GitHub repository rather than a public issue.
