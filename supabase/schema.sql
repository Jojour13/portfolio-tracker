-- ===========================================================================
-- Folio — Supabase schema for optional cloud sync
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Row Level Security ensures each user can only see their own rows.
-- ===========================================================================

create table if not exists assets (
  id           text not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         text not null check (type in ('crypto','stock','fund','bond','money_market','cash')),
  symbol       text not null,
  name         text not null,
  currency     text not null,
  quote_source text not null,
  quote_id     text not null,
  lot_size     numeric not null default 1,
  created_at   timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists transactions (
  id        text not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id  text not null,
  side      text not null check (side in ('buy','sell')),
  quantity  numeric not null,
  price     numeric not null,
  fee       numeric not null default 0,
  date      date not null,
  note      text,
  settlement_id text,
  cash_flow_type text,
  income_category text,
  income_asset_id text,
  withholding_tax numeric,
  margin    boolean,
  leverage  numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint transactions_asset_owner_fkey
    foreign key (user_id, asset_id) references assets (user_id, id) on delete cascade
);

alter table transactions add column if not exists cash_flow_type text;
alter table transactions add column if not exists income_category text;
alter table transactions add column if not exists income_asset_id text;
alter table transactions add column if not exists withholding_tax numeric;
alter table transactions drop constraint if exists transactions_cash_flow_type_check;
alter table transactions add constraint transactions_cash_flow_type_check
  check (cash_flow_type is null or cash_flow_type in ('external','income','transfer','settlement'));
alter table transactions drop constraint if exists transactions_income_category_check;
alter table transactions add constraint transactions_income_category_check
  check (income_category is null or income_category in ('dividend','interest','reward','other'));
alter table transactions drop constraint if exists transactions_withholding_tax_check;
alter table transactions add constraint transactions_withholding_tax_check
  check (withholding_tax is null or withholding_tax >= 0);
alter table transactions drop constraint if exists transactions_income_metadata_check;
alter table transactions add constraint transactions_income_metadata_check
  check (
    (
      income_category is null
      and income_asset_id is null
      and withholding_tax is null
    )
    or cash_flow_type = 'income'
  );
alter table transactions drop constraint if exists transactions_income_side_check;
alter table transactions add constraint transactions_income_side_check
  check (cash_flow_type is null or cash_flow_type <> 'income' or side = 'buy');

alter table assets drop constraint if exists assets_type_check;
alter table assets add constraint assets_type_check
  check (type in ('crypto','stock','fund','bond','money_market','cash'));
alter table assets drop constraint if exists assets_quote_source_check;
alter table assets add constraint assets_quote_source_check
  check (
    (type = 'cash' and quote_source = 'cash')
    or (type <> 'cash' and quote_source in ('coingecko','yahoo'))
  );
alter table assets drop constraint if exists assets_lot_size_check;
alter table assets add constraint assets_lot_size_check
  check (lot_size > 0);
alter table assets drop constraint if exists assets_cash_identity_check;
alter table assets add constraint assets_cash_identity_check
  check (
    type <> 'cash'
    or (
      symbol = currency
      and quote_id = ('cash-' || lower(currency))
    )
  );

alter table transactions drop constraint if exists transactions_asset_owner_fkey;
alter table transactions drop constraint if exists transactions_income_asset_owner_fkey;
alter table transactions drop constraint if exists transactions_asset_id_fkey;
alter table transactions drop constraint if exists transactions_pkey;
alter table assets drop constraint if exists assets_pkey;
alter table assets drop constraint if exists assets_user_id_id_unique;
alter table assets drop constraint if exists assets_user_type_quote_unique;
alter table assets add constraint assets_pkey primary key (user_id, id);
alter table assets add constraint assets_user_type_quote_unique unique (user_id, type, quote_id);
alter table transactions add constraint transactions_pkey primary key (user_id, id);
alter table transactions add constraint transactions_asset_owner_fkey
  foreign key (user_id, asset_id) references assets (user_id, id) on delete cascade;
alter table transactions add constraint transactions_income_asset_owner_fkey
  foreign key (user_id, income_asset_id) references assets (user_id, id);
alter table transactions drop constraint if exists transactions_amounts_check;
alter table transactions add constraint transactions_amounts_check
  check (quantity > 0 and price > 0 and fee >= 0);
alter table transactions drop constraint if exists transactions_leverage_check;
alter table transactions add constraint transactions_leverage_check
  check (leverage is null or leverage >= 1);

create table if not exists settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  base_currency    text not null default 'IDR',
  refresh_interval int not null default 30
);

alter table settings drop constraint if exists settings_base_currency_check;
alter table settings add constraint settings_base_currency_check
  check (base_currency in ('USD','IDR','SGD','CHF','EUR'));
alter table settings drop constraint if exists settings_refresh_interval_check;
alter table settings add constraint settings_refresh_interval_check
  check (refresh_interval > 0);

-- Row Level Security ----------------------------------------------------------
alter table assets        enable row level security;
alter table transactions  enable row level security;
alter table settings      enable row level security;

drop policy if exists "own assets" on assets;
drop policy if exists "own transactions" on transactions;
drop policy if exists "own settings" on settings;

create policy "own assets"       on assets       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"     on settings     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
