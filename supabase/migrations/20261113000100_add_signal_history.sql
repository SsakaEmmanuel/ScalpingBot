-- ScalpingBot 2.0: private, per-user read-only signal journal.
-- Additive migration: existing cTrader tokens and trading tables are untouched.
create table if not exists public.signal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (length(symbol) between 3 and 24),
  timeframe text not null check (timeframe in ('M1','M5','M15','M30','H1')),
  signal text not null check (signal in ('BUY','SELL','WAIT','NEUTRAL')),
  setup_score smallint not null default 0 check (setup_score between 0 and 100),
  candle_time timestamptz not null,
  close numeric not null,
  ema9 numeric,
  ema21 numeric,
  rsi14 numeric,
  atr14 numeric,
  swing_high numeric,
  swing_low numeric,
  momentum numeric,
  reasons jsonb not null default '[]'::jsonb,
  invalidation text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol, timeframe, candle_time)
);

alter table public.signal_history enable row level security;
create index if not exists signal_history_user_created_idx
  on public.signal_history (user_id, created_at desc);

drop policy if exists "Users view own signal history" on public.signal_history;
create policy "Users view own signal history"
  on public.signal_history for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own signal history" on public.signal_history;
create policy "Users insert own signal history"
  on public.signal_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own signal history" on public.signal_history;
create policy "Users delete own signal history"
  on public.signal_history for delete to authenticated
  using ((select auth.uid()) = user_id);
