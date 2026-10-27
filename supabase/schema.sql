-- Run this in the Supabase SQL editor (Database -> SQL).
-- Creates the habits + entries + profiles + user_settings tables, the private
-- avatars storage bucket, and RLS policies for all of them. Safe to re-run:
-- every statement is guarded with "if not exists" / "on conflict do update".

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
  updated_at timestamptz not null default now()
);

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