-- Run this in the Supabase SQL editor (Database -> SQL).
-- Creates the habits + entries (+ status) + vacation_periods + profiles (+ bio)
-- + user_settings + notification_settings + push_subscriptions tables, the
-- private avatars storage bucket, and RLS policies for all of them. Safe to
-- re-run: tables via "if not exists", post-release columns via guarded alters,
-- Pass 2 / vacation policies via "drop policy if exists". Note: the legacy
-- habits/entries/profiles/user_settings `create policy` statements are NOT
-- guarded — re-running on a project that already has them will error harmlessly.

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
  -- Optional emoji painted inside the tile's check ring (up to 24 code points,
  -- enough for ZWJ families and skin-tone sequences).
  emoji text check (emoji is null or char_length(emoji) between 1 and 24),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Added after the first release (existing projects): safe to re-run.
alter table public.habits add column if not exists emoji text;

-- The first release capped emoji at 8 code points; the full picker can produce
-- longer ZWJ/skin-tone sequences, so widen the check to 24. Runs after the
-- column exists and is safe to re-run (Postgres auto-names the inline check
-- `habits_emoji_check`).
alter table public.habits drop constraint if exists habits_emoji_check;
alter table public.habits
  add constraint habits_emoji_check
  check (emoji is null or char_length(emoji) between 1 and 24);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  value numeric not null default 0 check (value >= 0),
  -- 'done' (default) or 'skipped' (neutral day: the row stores value 0 and is
  -- never "done"; see src/lib/dayStatus.ts). Postgres auto-names the inline
  -- check `entries_status_check`.
  status text not null default 'done' check (status in ('done', 'skipped')),
  unique (habit_id, date)
);

-- Added after the first release (existing projects): safe to re-run.
alter table public.entries add column if not exists status text not null default 'done';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'entries_status_check') then
    alter table public.entries
      add constraint entries_status_check check (status in ('done', 'skipped'));
  end if;
end $$;

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

-- One row per user, created on first save (upsert from the Profile page).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  date_of_birth date,
  gender text check (gender in ('female', 'male', 'other', 'prefer_not_to_say')),
  nationality text,
  country text,
  address text,
  phone text,
  avatar_path text,
  -- Optional motivation line (≤ 140 code points, matching the client
  -- validator's Array.from length; see src/lib/profile.ts). Postgres auto-names
  -- the inline check `profiles_bio_check`.
  bio text check (bio is null or char_length(bio) <= 140),
  updated_at timestamptz not null default now()
);

-- Added after the first release (existing projects): safe to re-run.
alter table public.profiles add column if not exists bio text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_check') then
    alter table public.profiles
      add constraint profiles_bio_check check (bio is null or char_length(bio) <= 140);
  end if;
end $$;

-- One row per user, created on first save (Day start setting; 0..6, default 0).
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day_start_hour smallint not null default 0 check (day_start_hour between 0 and 6),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can view own settings"
  on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);

-- Vacation periods: neutral "off stretches" for every habit (end_date null =
-- ongoing; a done check-in during vacation still wins — see src/lib/vacation.ts).
-- Some projects already have this table from the Pass that introduced vacation
-- mode; everything here is guarded, so re-running is safe. Policies use
-- drop-if-exists to stay re-runnable.
create table if not exists public.vacation_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now()
);

alter table public.vacation_periods enable row level security;

drop policy if exists "Users can view own vacation periods"
  on public.vacation_periods;
create policy "Users can view own vacation periods"
  on public.vacation_periods for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own vacation periods"
  on public.vacation_periods;
create policy "Users can insert own vacation periods"
  on public.vacation_periods for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own vacation periods"
  on public.vacation_periods;
create policy "Users can update own vacation periods"
  on public.vacation_periods for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can delete own vacation periods"
  on public.vacation_periods;
create policy "Users can delete own vacation periods"
  on public.vacation_periods for delete to authenticated
  using (auth.uid() = user_id);

-- Private avatars bucket: 2 MB, jpeg/png/webp, files at <user_id>/avatar.webp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Users can read own avatar"
  on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DAILY REMINDERS (Pass 2 — database foundation)
--
-- notification_settings: one row per user (user_id is the PK, matching
-- profiles/user_settings; upsert on user_id).
-- push_subscriptions: multiple devices per user; endpoint is UNIQUE so
-- re-subscribing a device upserts instead of duplicating. Only public
-- Web Push key material is stored (p256dh/auth per RFC 8291) — never VAPID
-- private keys or service-role keys.
-- Some projects already ran this section from the standalone script; every
-- statement is guarded and safe to re-run.
-- ============================================================

-- Pre-fold rename guard: projects that ran the standalone Pass 2 script got
-- idx_*-prefixed indexes; move them to the repo's suffix convention first so
-- the "create index if not exists" statements below are no-ops there.
alter index if exists idx_push_subscriptions_user_id rename to push_subscriptions_user_idx;
alter index if exists idx_notification_settings_enabled rename to notification_settings_enabled_idx;

-- 1. Notification preferences: one row per user.
create table if not exists public.notification_settings (
  user_id uuid primary key
    references auth.users (id) on delete cascade,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '20:00:00',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_settings_timezone_not_empty
    check (length(trim(timezone)) > 0)
);

-- 2. Push subscriptions: multiple devices per user.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_endpoint_not_empty check (length(trim(endpoint)) > 0),
  constraint push_p256dh_not_empty check (length(trim(p256dh)) > 0),
  constraint push_auth_not_empty check (length(trim(auth)) > 0)
);

-- 3. Indexes (suffix convention). The partial index serves the Pass 3 cron
-- dispatcher: find every user with reminders enabled.
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
create index if not exists notification_settings_enabled_idx
  on public.notification_settings (reminder_enabled)
  where reminder_enabled = true;

-- 4. Enable RLS; anon has no legitimate use for these tables.
alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.notification_settings from anon;
revoke all on public.push_subscriptions from anon;

-- 5. Notification settings policies.
drop policy if exists "Users can view own notification settings"
  on public.notification_settings;
create policy "Users can view own notification settings"
  on public.notification_settings for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own notification settings"
  on public.notification_settings;
create policy "Users can insert own notification settings"
  on public.notification_settings for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own notification settings"
  on public.notification_settings;
create policy "Users can update own notification settings"
  on public.notification_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can delete own notification settings"
  on public.notification_settings;
create policy "Users can delete own notification settings"
  on public.notification_settings for delete to authenticated
  using (auth.uid() = user_id);

-- 6. Push subscription policies.
drop policy if exists "Users can view own push subscriptions"
  on public.push_subscriptions;
create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can register own push subscriptions"
  on public.push_subscriptions;
create policy "Users can register own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own push subscriptions"
  on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can delete own push subscriptions"
  on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);