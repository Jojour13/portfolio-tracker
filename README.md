# ƒ Folio — live multi-asset portfolio

A clean, real-time portfolio dashboard for **crypto, stocks (IDX / SGX / US) and multi-currency cash**, all normalised into one allocation pie. Built as a responsive web app — looks great on desktop and installs to your phone home screen as a PWA.

![status](https://img.shields.io/badge/status-MVP-6366f1) ![next](https://img.shields.io/badge/Next.js-15-black) ![license](https://img.shields.io/badge/license-MIT-22c55e)

## Features

- 📊 **Allocation donut** — every asset converted to your base currency (IDR / SGD / CHF / USD / EUR) at live FX.
- ⚡ **Real-time prices** — crypto via CoinGecko, stocks via Yahoo Finance, auto-refreshing on an interval you choose.
- 🧮 **Average-cost tracking** — buy more of something and your average price adjusts automatically. Realised + unrealised P/L derived from your trade history.
- 🪙 **Lots-aware** — IDX positions entered in lots (1 lot = 100 shares); crypto in coins; cash as balances.
- 🧾 **Trade history** — full log, filterable by asset type, with one-tap delete.
- 📱 **PWA** — installable, offline shell, mobile bottom-nav.
- 🔒 **Local-first** — your data lives in your browser by default. Add Supabase and it becomes a secure multi-device account.
- 🔐 **Private by design** — passwords are bcrypt-hashed (never visible to anyone), email-based password reset, and Row-Level Security isolates every user's data. See [SECURITY.md](SECURITY.md).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app ships with a sample portfolio so you can see it working immediately. Clear it from **Settings → Clear everything**, then add your own trades.

## How prices work

| Asset | Source | Endpoint (proxied server-side) |
|-------|--------|-------------------------------|
| Crypto | CoinGecko | `/api/crypto` |
| Stocks (US / `.SI` SGX / `.JK` IDX) | Yahoo Finance | `/api/quote` |
| FX rates | open.er-api.com | `/api/fx` |
| Symbol search | Yahoo + CoinGecko | `/api/search` |

All third-party calls are proxied through Next.js API routes — this avoids CORS and keeps the client simple. Stock quotes are delayed (~15 min) and unofficial; treat them as indicative, not for execution.

## Cloud sync + accounts (Supabase — free tier)

Folio works fully offline with **zero setup**. To turn on accounts and cross-device sync:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) — this creates the tables **and** the Row-Level Security policies that keep each user's data private.
3. Copy `.env.local.example` → `.env.local` and paste your **Project URL** and **anon key** (Project Settings → API).
4. Restart `npm run dev`.

Now the app requires sign-in, and each account's portfolio syncs to the cloud. Auth pages (`/login`, `/reset`) are built in: email + password, with **email-based password reset**.

**Email delivery:** Supabase's built-in email works out of the box for testing (rate-limited). For production, add your own SMTP under Authentication → Email, or disable “Confirm email” for a smoother demo (Authentication → Providers → Email).

**Security model:** passwords are bcrypt-hashed and never readable by anyone; data isolation is enforced at the database by RLS. Full details and the zero-knowledge tradeoff in [SECURITY.md](SECURITY.md).

## Deploy

Push to GitHub and import into [Vercel](https://vercel.com) — zero config. Add the Supabase env vars in the Vercel dashboard if using cloud sync.

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind v4 · TanStack Query · Recharts · Zustand · Supabase.

## Roadmap

- [ ] Supabase auth + live sync wired into the UI
- [ ] Per-asset historical value chart (sparklines)
- [ ] Realised P/L & dividends report
- [ ] CSV import/export
- [ ] Price + target alerts

## Disclaimer

Folio is a personal tracking tool, not investment advice. Prices are best-effort from free public sources and may be delayed or inaccurate. Verify against your broker before acting.

## License

MIT
