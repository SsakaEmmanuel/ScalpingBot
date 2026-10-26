-- cTrader OAuth/session storage for ScalpingBot.
-- Tokens are encrypted by the ctrader-connect Edge Function before entering the database.
-- No browser policies are granted; the Edge Function verifies the signed-in user and performs server-side reads/writes.

create table if not exists public.ctrader_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker text not null default 'Pepperstone',
  environment text not null default 'demo' check (environment in ('demo')),
  ctid_trader_account_id bigint not null,
  account_label text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz,
  token_type text not null default 'Bearer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ctid_trader_account_id)
);

alter table public.ctrader_connections enable row level security;

create index if not exists ctrader_connections_user_id_idx
  on public.ctrader_connections (user_id);

create table if not exists public.ctrader_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ctrader_oauth_states enable row level security;

create index if not exists ctrader_oauth_states_expiry_idx
  on public.ctrader_oauth_states (expires_at);

-- Intentionally no policies for anon/authenticated roles.
-- Access is mediated by the ctrader-connect Edge Function only.
