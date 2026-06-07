# Security & Privacy

Folio is designed as a local-first portfolio tracker with optional Supabase sync. This document states the actual guarantees and the limits that matter before publishing.

## Passwords

- Authentication is handled by Supabase Auth.
- Folio never stores, logs, or directly handles plaintext passwords in its own tables.
- Password reset is handled through Supabase's reset flow; no human needs to know the old password.
- Minimum password length is enforced in the app, and Supabase applies its own auth protections.

Do not claim a specific Supabase password hashing algorithm in product copy unless it has been verified against current Supabase documentation or the deployed auth configuration.

## Data Isolation

Every synced table (`assets`, `transactions`, `settings`) is protected by Row-Level Security using `auth.uid() = user_id`.

That means:

- Each row is stamped with its owner's user id.
- The database refuses reads or writes for rows that do not belong to the current authenticated user.
- Transaction rows use an owner-scoped foreign key, so a transaction for one user cannot reference another user's asset id.
- The public Supabase anon key can be shipped to the browser because RLS and the user session are the real access controls.

High confidence: this is enforced by `supabase/schema.sql`, which defines RLS policies and owner-scoped constraints.

The schema also enforces core portfolio integrity: unique asset identities per user, positive transaction amounts, valid quote sources, valid cash ledgers, and sane settings values. This protects users from malformed writes even if a client-side bug or crafted request bypasses the UI.

## What The Project Owner Can See

Supabase project owners can access raw database tables through privileged project credentials. Folio is not zero-knowledge today.

This means:

- Passwords are not visible to Folio or stored in Folio tables.
- Portfolio holdings, transactions, and settings are visible to anyone with privileged database access.

## Optional Zero-Knowledge Mode

To make holdings unreadable even to the project owner, Folio would need client-side encryption before data is sent to Supabase.

Tradeoff: if the encryption key is derived from the user's password, password reset cannot recover old encrypted data. That is a deliberate product decision and should not be added casually.

## Secrets & Keys

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design and may be used in the browser.
- Supabase `service_role` keys must never be committed, exposed to the client, or used in Folio browser code.
- `.env.local` is git-ignored and should contain deployment-specific secrets only.

## Local Storage Risk

Without Supabase sync, the portfolio is stored in this browser profile. Anyone with access to the same browser profile may be able to view local data.

## CSV Export Safety

Trade-history CSV export neutralizes spreadsheet formulas in text cells, such as notes and asset names, before download. This reduces the risk of CSV formula execution when a file is opened in Excel, Google Sheets, or similar tools.

## Reporting

Found a vulnerability? Open a private security advisory on the GitHub repository rather than a public issue.
