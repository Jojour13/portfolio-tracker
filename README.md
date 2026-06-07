# Folio - live multi-asset portfolio

A clean, real-time portfolio dashboard for crypto, stocks, ETFs/funds, listed bond funds, money market funds, and multi-currency cash. Folio keeps everything normalised into one base currency so allocation, P/L, drift, and cash impact stay readable across accounts and markets.

![status](https://img.shields.io/badge/status-MVP-6366f1) ![next](https://img.shields.io/badge/Next.js-15-black) ![license](https://img.shields.io/badge/license-MIT-22c55e)

## Features

- Allocation donut: every asset converted to your base currency (IDR / SGD / CHF / USD / EUR) at live FX.
- Multi-asset transactions: crypto, stocks, ETFs/funds, listed bond funds, money market funds, and cash movements.
- Average-cost tracking: realised and unrealised P/L derived from transaction history.
- Cash ledger impact: buys, sells, deposits, withdrawals, dividends, interest, fees, and withholding tax can flow through cash.
- Lots-aware entries: IDX positions can be entered in lots (1 lot = 100 shares).
- Risk target design: compare crypto, equity/funds, fixed income, and cash/money-market weights against your plan.
- Trade history: full log, filterable by asset type, with CSV export.
- PWA shell: responsive desktop/mobile experience with install support.
- Local-first storage: your data stays in your browser by default. Add Supabase to sync across devices.
- Security model: Supabase Auth handles sign-in, and Row-Level Security isolates each user's portfolio rows. See [SECURITY.md](SECURITY.md).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app ships with a sample portfolio so you can see it working immediately. Clear it from Settings -> Clear everything, then add your own trades.

## How prices work

| Asset | Source | Endpoint (proxied server-side) |
|-------|--------|--------------------------------|
| Crypto | Yahoo Finance crypto symbols for new assets; legacy CoinGecko IDs still supported | `/api/quote`, `/api/crypto`, `/api/search` |
| Stocks (US / `.SI` SGX / `.JK` IDX) | Yahoo Finance | `/api/quote`, `/api/search` |
| ETFs/funds | Yahoo Finance | `/api/quote`, `/api/search` |
| Listed bond funds | Yahoo Finance fund/ETF results filtered for fixed-income terms | `/api/quote`, `/api/search` |
| Money market funds | Yahoo Finance fund/ETF results filtered for cash-equivalent terms | `/api/quote`, `/api/search` |
| FX rates | open.er-api.com | `/api/fx` |

All third-party calls are proxied through Next.js API routes to avoid client CORS issues. Quotes from free public endpoints can be delayed, incomplete, or inaccurate; treat them as indicative, not executable prices.

## Asset coverage limits

Folio intentionally does not model options yet.

Individual bonds are also not fully modeled. The current fixed-income flow is for listed bond funds and ETFs. True individual-bond support needs coupon schedules, maturity date, face value, accrued interest, amortisation, yield, and duration logic before it can be considered correct.

Money market funds are valued through ticker price/NAV. Separate daily yield accrual is not modeled unless you enter income manually.

## Cloud sync + accounts (Supabase)

Folio works fully offline with zero setup. To turn on accounts and cross-device sync:

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). This creates the tables and Row-Level Security policies.
3. Copy `.env.local.example` to `.env.local` and paste your project URL and anon key.
4. Restart `npm run dev`.

Now the app requires sign-in, and each account's portfolio syncs to the cloud. Auth pages (`/login`, `/reset`) support email/password sign-in and password reset.

## Deploy

Push to GitHub and import into Vercel. Add Supabase environment variables in Vercel if cloud sync is enabled.

## Tech

Next.js 15 (App Router), TypeScript, Tailwind v4, TanStack Query, Recharts, Zustand, Supabase.

## Roadmap

- [x] Supabase auth + live sync wired into the UI
- [x] Filtered transaction CSV export
- [x] Funds, listed bond funds, and money market fund entry
- [ ] Individual bond accounting
- [ ] Per-asset historical value chart
- [ ] Tax-year income and realised P/L reports
- [ ] Price + target alerts

## Disclaimer

Folio is a personal tracking tool, not investment advice. Prices are best-effort from free public sources and may be delayed or inaccurate. Verify against your broker before acting.

## License

MIT
