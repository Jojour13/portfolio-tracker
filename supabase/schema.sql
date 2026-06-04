-- ===========================================================================
-- Folio — Supabase schema for optional cloud sync
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Row Level Security ensures each user can only see their own rows.
-- ===========================================================================

create table if not exists assets (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         text not null check (type in ('crypto','stock','cash')),
  symbol       text not null,
  name         text not null,
  currency     text not null,
  quote_source text not null,
  quote_id     text not null,
  lot_size     numeric not null default 1,
  created_at   timestamptz not null default now()
);

create table if not exists transactions (
  id        text primary key,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id  text not null references assets (id) on delete cascade,
  side      text not null check (side in ('buy','sell')),
  quantity  numeric not null,
  price     numeric not null,
  fee       numeric not null default 0,
  date      date not null,
  note      text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  base_currency    text not null default 'IDR',
  refresh_interval int not null default 30
);

-- Row Level Security ----------------------------------------------------------
alter table assets        enable row level security;
alter table transactions  enable row level security;
alter table settings      enable row level security;

create policy "own assets"       on assets       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"     on settings     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
