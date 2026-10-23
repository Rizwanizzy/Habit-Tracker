-- Run this in the Supabase SQL editor (Database -> SQL).
-- Creates the habits + entries tables with RLS enabled and per-user policies.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'boolean' check (type in ('boolean', 'numeric')),
  target numeric not null default 1 check (target > 0),
  unit text,
  freq_times integer not null default 1 check (freq_times >= 1),
  freq_days integer not null default 1 check (freq_days >= 1),
  color text not null default '#3B82F6',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  value numeric not null default 0 check (value >= 0),
  unique (habit_id, date)
);

create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists entries_user_idx on public.entries (user_id);
create index if not exists entries_habit_date_idx on public.entries (habit_id, date);

alter table public.habits enable row level security;
alter table public.entries enable row level security;

create policy "Users can view own habits"
  on public.habits for select using (auth.uid() = user_id);
create policy "Users can insert own habits"
  on public.habits for insert with check (auth.uid() = user_id);
create policy "Users can update own habits"
  on public.habits for update using (auth.uid() = user_id);
create policy "Users can delete own habits"
  on public.habits for delete using (auth.uid() = user_id);

create policy "Users can view own entries"
  on public.entries for select using (auth.uid() = user_id);
create policy "Users can insert own entries"
  on public.entries for insert with check (auth.uid() = user_id);
create policy "Users can update own entries"
  on public.entries for update using (auth.uid() = user_id);
create policy "Users can delete own entries"
  on public.entries for delete using (auth.uid() = user_id);