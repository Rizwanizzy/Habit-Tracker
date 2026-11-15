-- Base v7 scheduling migration for databases created before Habit Scheduling.
--
-- Deployment order (all three are required before the scheduling frontend is
-- used against this database):
--   1. 20261113_schedule_base_v7.sql   (this file)
--   2. 20261114_custom_schedule_rpc.sql
--   3. 20261115_fix_legacy_same_day_overwrite.sql
--
-- This file is intentionally production/base-only. It refuses to run when the
-- scheduling schema already exists (for example on staging, which already has
-- the complete infrastructure). It does not touch public.entries, does not
-- rewrite check-ins, and does not delete any habit.
--
-- Classification of the existing rows:
--   * freq_times = 1 AND freq_days = 1  -> schedule_type = 'daily'
--   * every other freq pair            -> schedule_type = 'legacy'
-- The original freq_times/freq_days values are never changed. Legacy history
-- epochs receive the exact frozen snapshot, including values where
-- freq_times > freq_days (e.g. 5/1) and values that Custom no longer allows.
--
-- Existing habits receive ONE initial history epoch dated at their logical
-- created_at date. No later schedule changes are invented; the historical
-- check-ins remain in public.entries untouched.

begin;

-- ============================================================
-- 0. PREFLIGHT GUARD
-- ============================================================
-- Abort before any DDL if this is not a pre-scheduling database. This protects
-- staging (and any retry after a committed partial apply) from having its
-- existing Custom constraints replaced by the v7-only versions below.
do $$
begin
    if exists (
        select 1
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'habits'
           and column_name = 'schedule_type'
    )
    or to_regclass('public.habit_schedule_history') is not null
    or exists (
        select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in (
               'append_habit_schedule_epoch',
               'normalize_habit_schedule',
               'guard_habit_schedule_columns',
               'seed_habit_schedule_history'
           )
    ) then
        raise exception
            'Base scheduling migration aborted: scheduling objects already exist. Apply only to a pre-scheduling database.';
    end if;

    if to_regclass('public.habits') is null
       or to_regclass('public.user_settings') is null
       or to_regclass('auth.users') is null then
        raise exception
            'Base scheduling migration aborted: required tables public.habits, public.user_settings, or auth.users are missing.';
    end if;
end $$;

-- Read-only preflight (run separately before this migration if desired):
--   select freq_times, freq_days, count(*)
--     from public.habits
--    group by 1, 2
--    order by 1, 2;
--   -- expected for the known production data: 22 rows at 1/1, 1 at 5/1,
--   -- 1 at 1/2.
--
--   select count(*) from public.habits;                 -- expected 24
--   select count(*) from public.entries;                -- unchanged by this file
--   select count(*) from public.user_settings;          -- missing rows use 0
--   select current_setting('server_version');           -- needs PostgreSQL 14+
--                                                       -- for bit_count()

-- ============================================================
-- 1. HABIT SCHEDULE COLUMNS
-- ============================================================
alter table public.habits
    add column if not exists schedule_type text not null default 'daily',
    add column if not exists scheduled_days smallint,
    add column if not exists interval_days integer,
    add column if not exists weekly_target integer;

-- Classify the existing rows before adding the CHECK constraints. The added
-- schedule_type default already says 'daily'; only non-1/1 rows move to legacy.
-- The original freq_times/freq_days values are deliberately left untouched.
update public.habits
set schedule_type = case
        when freq_times = 1 and freq_days = 1 then 'daily'
        else 'legacy'
    end,
    scheduled_days = null,
    interval_days = null,
    weekly_target = null;

-- ============================================================
-- 2. SCHEDULE HISTORY TABLE
-- ============================================================
create table public.habit_schedule_history (
    id uuid primary key default gen_random_uuid(),
    habit_id uuid not null references public.habits (id) on delete cascade,
    user_id uuid not null default auth.uid()
        references auth.users (id) on delete cascade,
    effective_from date not null,
    schedule_type text not null,
    scheduled_days smallint,
    interval_days integer,
    weekly_target integer,
    legacy_freq_times integer,
    legacy_freq_days integer,
    created_at timestamptz not null default now(),
    constraint habit_schedule_history_habit_effective_key
        unique (habit_id, effective_from)
);

create index habit_schedule_history_user_idx
    on public.habit_schedule_history (user_id);

-- SELECT-only for the app; epochs are written by the SECURITY DEFINER RPC and
-- the seed trigger. RLS prevents direct client writes.
alter table public.habit_schedule_history enable row level security;
revoke all on public.habit_schedule_history from public;
revoke all on public.habit_schedule_history from anon;
revoke insert, update, delete on public.habit_schedule_history from authenticated;
grant select on public.habit_schedule_history to authenticated;

drop policy if exists "Users can view own schedule history"
    on public.habit_schedule_history;
create policy "Users can view own schedule history"
    on public.habit_schedule_history for select to authenticated
    using (auth.uid() = user_id);

-- ============================================================
-- 3. V7 CHECK CONSTRAINTS
-- ============================================================
-- These are the v7 definitions. 20261114 replaces all four by name and adds
-- the `custom` branches; 20261115 then adds the legacy same-day guard to the
-- 7-argument RPC. Legacy is deliberately not narrowed here.
alter table public.habits
    drop constraint if exists habits_freq_mirror_ck;

alter table public.habits
    add constraint habits_freq_mirror_ck
    check (
        case schedule_type
            when 'daily' then
                freq_times = 1
                and freq_days = 1
            when 'weekdays' then
                scheduled_days is not null
                and freq_times is not null
                and freq_days is not null
                and freq_days = 7
                and freq_times = bit_count(scheduled_days::integer::bit(16))
            when 'interval' then
                freq_times = 1
                and interval_days is not null
                and freq_days = interval_days
            when 'weekly_target' then
                freq_days = 7
                and weekly_target is not null
                and freq_times = weekly_target
            when 'legacy' then
                freq_times >= 1
                and freq_days >= 1
            else false
        end
    );

alter table public.habits
    drop constraint if exists habits_schedule_shape;

alter table public.habits
    add constraint habits_schedule_shape
    check (
        case schedule_type
            when 'daily' then
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
            when 'weekdays' then
                scheduled_days is not null
                and scheduled_days >= 1
                and scheduled_days <= 127
                and interval_days is null
                and weekly_target is null
            when 'interval' then
                interval_days is not null
                and interval_days >= 2
                and scheduled_days is null
                and weekly_target is null
            when 'weekly_target' then
                weekly_target is not null
                and weekly_target >= 1
                and weekly_target <= 7
                and scheduled_days is null
                and interval_days is null
            when 'legacy' then
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
            else false
        end
    );

alter table public.habit_schedule_history
    drop constraint if exists habit_schedule_history_shape;

alter table public.habit_schedule_history
    add constraint habit_schedule_history_shape
    check (
        case schedule_type
            when 'daily' then
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
                and legacy_freq_times is null
                and legacy_freq_days is null
            when 'weekdays' then
                scheduled_days is not null
                and scheduled_days >= 1
                and scheduled_days <= 127
                and interval_days is null
                and weekly_target is null
                and legacy_freq_times is null
                and legacy_freq_days is null
            when 'interval' then
                interval_days is not null
                and interval_days >= 2
                and scheduled_days is null
                and weekly_target is null
                and legacy_freq_times is null
                and legacy_freq_days is null
            when 'weekly_target' then
                weekly_target is not null
                and weekly_target >= 1
                and weekly_target <= 7
                and scheduled_days is null
                and interval_days is null
                and legacy_freq_times is null
                and legacy_freq_days is null
            when 'legacy' then
                -- Preserve historical frequencies exactly. No upper bound and
                -- no times<=days rule: 5/1 and values above the Custom limit
                -- must remain valid legacy snapshots.
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
                and legacy_freq_times is not null
                and legacy_freq_days is not null
                and legacy_freq_times >= 1
                and legacy_freq_days >= 1
            else false
        end
    );

alter table public.habit_schedule_history
    drop constraint if exists habit_schedule_history_type_ck;

alter table public.habit_schedule_history
    add constraint habit_schedule_history_type_ck
    check (
        schedule_type in ('daily', 'weekdays', 'interval', 'weekly_target', 'legacy')
    );

-- ============================================================
-- 4. INITIAL HISTORY FOR EXISTING HABITS
-- ============================================================
-- One epoch per habit at its logical created_at date. This is the initial
-- schedule, not an invented change. The left join keeps habits whose user has
-- no user_settings row (day start 0).
insert into public.habit_schedule_history (
    habit_id,
    user_id,
    effective_from,
    schedule_type,
    scheduled_days,
    interval_days,
    weekly_target,
    legacy_freq_times,
    legacy_freq_days
)
select
    h.id,
    h.user_id,
    ((h.created_at at time zone 'Asia/Kolkata')
        - make_interval(hours => coalesce(us.day_start_hour, 0)))::date,
    h.schedule_type,
    null,
    null,
    null,
    case when h.schedule_type = 'legacy' then h.freq_times else null end,
    case when h.schedule_type = 'legacy' then h.freq_days else null end
from public.habits h
left join public.user_settings us on us.user_id = h.user_id
on conflict (habit_id, effective_from) do nothing;

-- ============================================================
-- 5. V7 TRIGGER FUNCTIONS AND TRIGGERS
-- ============================================================
-- normalize_habit_schedule: BEFORE INSERT only. A pre-scheduling client omits
-- schedule_type (default daily) and may still send any freq_times/freq_days;
-- only that daily + non-1/1 combination is reclassified to legacy.
create or replace function public.normalize_habit_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.schedule_type = 'daily'
       and (new.freq_times <> 1 or new.freq_days <> 1) then
        new.schedule_type := 'legacy';
    end if;
    return new;
end;
$$;

-- guard_habit_schedule_columns: BEFORE UPDATE. Schedule/frequency columns are
-- writable only by the habits table owner. The SECURITY DEFINER RPC runs as
-- that owner; ordinary authenticated updates (details, archive, sort order)
-- do not touch these columns and pass. Deliberately NOT SECURITY DEFINER.
create or replace function public.guard_habit_schedule_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_owner name;
begin
    if old.schedule_type is not distinct from new.schedule_type
       and old.scheduled_days is not distinct from new.scheduled_days
       and old.interval_days is not distinct from new.interval_days
       and old.weekly_target is not distinct from new.weekly_target
       and old.freq_times is not distinct from new.freq_times
       and old.freq_days is not distinct from new.freq_days then
        return new;
    end if;

    select pg_get_userbyid(c.relowner)
      into v_owner
      from pg_class c
     where c.oid = 'public.habits'::regclass;

    if current_user is distinct from v_owner then
        raise exception
            'Schedule fields can only be changed through append_habit_schedule_epoch.'
            using errcode = 'P0001';
    end if;

    return new;
end;
$$;

-- seed_habit_schedule_history: AFTER INSERT. Creates the first epoch at the
-- habit's logical created_at date using the same Asia/Kolkata +
-- day_start_hour rule as the RPC. The legacy snapshot is filled only for
-- legacy; the later Custom fill trigger supplies custom snapshots.
create or replace function public.seed_habit_schedule_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_day_start integer := 0;
    v_effective_from date;
begin
    select coalesce(us.day_start_hour, 0)
      into v_day_start
      from public.user_settings us
     where us.user_id = new.user_id;

    if v_day_start is null then
        v_day_start := 0;
    end if;

    v_effective_from :=
        ((new.created_at at time zone 'Asia/Kolkata')
            - make_interval(hours => v_day_start))::date;

    insert into public.habit_schedule_history (
        habit_id,
        user_id,
        effective_from,
        schedule_type,
        scheduled_days,
        interval_days,
        weekly_target,
        legacy_freq_times,
        legacy_freq_days
    ) values (
        new.id,
        new.user_id,
        v_effective_from,
        new.schedule_type,
        new.scheduled_days,
        new.interval_days,
        new.weekly_target,
        case when new.schedule_type = 'legacy' then new.freq_times else null end,
        case when new.schedule_type = 'legacy' then new.freq_days else null end
    )
    on conflict (habit_id, effective_from) do nothing;

    return new;
end;
$$;

drop trigger if exists habits_normalize_schedule on public.habits;
create trigger habits_normalize_schedule
    before insert on public.habits
    for each row
    execute function public.normalize_habit_schedule();

drop trigger if exists habits_guard_schedule_columns on public.habits;
create trigger habits_guard_schedule_columns
    before update on public.habits
    for each row
    execute function public.guard_habit_schedule_columns();

drop trigger if exists habits_seed_schedule_history on public.habits;
create trigger habits_seed_schedule_history
    after insert on public.habits
    for each row
    execute function public.seed_habit_schedule_history();

-- ============================================================
-- 6. ORIGINAL V7 5-PARAMETER RPC
-- ============================================================
-- 20261114 drops this exact signature and replaces it with the 7-argument
-- Custom-aware version. Kept here so the base schema is complete and usable
-- on its own. The legacy same-day guard is included so even the brief
-- base-only window cannot overwrite a frozen legacy epoch.
drop function if exists public.append_habit_schedule_epoch(
    uuid,
    text,
    smallint,
    integer,
    integer
);

create or replace function public.append_habit_schedule_epoch(
    p_habit_id uuid,
    p_schedule_type text,                       -- daily | weekdays | interval | weekly_target
    p_scheduled_days smallint default null,     -- weekday bitmask (weekdays)
    p_interval_days integer default null,       -- N (interval, >= 2)
    p_weekly_target integer default null        -- M (weekly_target, 1..7)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_habit public.habits%rowtype;
    v_freq_times integer;
    v_freq_days integer;
    v_day_start integer := 0;
    v_effective_from date;
    v_same_day_epoch boolean := false;
begin
    select * into v_habit
    from public.habits
    where id = p_habit_id
      and user_id = auth.uid();

    if not found then
        raise exception 'Habit not found or access denied' using errcode = 'P0001';
    end if;

    if p_schedule_type not in ('daily', 'weekdays', 'interval', 'weekly_target') then
        raise exception 'Invalid schedule_type: %', p_schedule_type using errcode = 'P0002';
    end if;

    case p_schedule_type
        when 'daily' then
            if p_scheduled_days is not null
               or p_interval_days is not null
               or p_weekly_target is not null then
                raise exception 'Daily habits do not take weekday, interval or weekly-target values.' using errcode = 'P0003';
            end if;
            v_freq_times := 1;
            v_freq_days := 1;

        when 'weekdays' then
            if p_scheduled_days is null or p_scheduled_days < 1 or p_scheduled_days > 127 then
                raise exception 'Pick at least one day of the week.' using errcode = 'P0004';
            end if;
            if p_interval_days is not null or p_weekly_target is not null then
                raise exception 'Weekday schedules take a day mask only.' using errcode = 'P0005';
            end if;
            v_freq_times := 0;
            for i in 0..6 loop
                if (p_scheduled_days & (1 << i)) != 0 then
                    v_freq_times := v_freq_times + 1;
                end if;
            end loop;
            v_freq_days := 7;

        when 'interval' then
            if p_interval_days is null or p_interval_days < 2 then
                raise exception 'The interval must be 2 days or more.' using errcode = 'P0006';
            end if;
            if p_scheduled_days is not null or p_weekly_target is not null then
                raise exception 'Interval schedules take a day interval only.' using errcode = 'P0007';
            end if;
            v_freq_times := 1;
            v_freq_days := p_interval_days;

        when 'weekly_target' then
            if p_weekly_target is null or p_weekly_target < 1 or p_weekly_target > 7 then
                raise exception 'The weekly target must be 1 to 7 times a week.' using errcode = 'P0008';
            end if;
            if p_scheduled_days is not null or p_interval_days is not null then
                raise exception 'Weekly-target schedules take a weekly target only.' using errcode = 'P0009';
            end if;
            v_freq_times := p_weekly_target;
            v_freq_days := 7;
    end case;

    select coalesce(us.day_start_hour, 0)
      into v_day_start
      from public.user_settings us
     where us.user_id = auth.uid();

    if v_day_start is null then
        v_day_start := 0;
    end if;

    v_effective_from :=
        ((now() at time zone 'Asia/Kolkata') - make_interval(hours => v_day_start))::date;

    if exists (
        select 1
        from public.habit_schedule_history
        where habit_id = p_habit_id
          and effective_from = v_effective_from
          and schedule_type = 'legacy'
    ) then
        raise exception 'This habit''s original legacy schedule is still active today. Try again after the next logical day.'
            using errcode = 'P0001';
    end if;

    select exists(
        select 1 from public.habit_schedule_history
        where habit_id = p_habit_id
          and effective_from = v_effective_from
    ) into v_same_day_epoch;

    if v_same_day_epoch then
        update public.habit_schedule_history
        set schedule_type     = p_schedule_type,
            scheduled_days    = p_scheduled_days,
            interval_days     = p_interval_days,
            weekly_target     = p_weekly_target,
            legacy_freq_times = null,
            legacy_freq_days  = null
        where habit_id = p_habit_id
          and effective_from = v_effective_from;
    else
        insert into public.habit_schedule_history (
            habit_id,
            user_id,
            effective_from,
            schedule_type,
            scheduled_days,
            interval_days,
            weekly_target,
            legacy_freq_times,
            legacy_freq_days
        ) values (
            p_habit_id,
            v_habit.user_id,
            v_effective_from,
            p_schedule_type,
            p_scheduled_days,
            p_interval_days,
            p_weekly_target,
            null,
            null
        );
    end if;

    update public.habits
    set schedule_type  = p_schedule_type,
        scheduled_days = p_scheduled_days,
        interval_days  = p_interval_days,
        weekly_target  = p_weekly_target,
        freq_times     = v_freq_times,
        freq_days      = v_freq_days
    where id = p_habit_id;

exception
    when sqlstate 'P0001' then raise;
    when sqlstate 'P0002' then raise;
    when sqlstate 'P0003' then raise;
    when sqlstate 'P0004' then raise;
    when sqlstate 'P0005' then raise;
    when sqlstate 'P0006' then raise;
    when sqlstate 'P0007' then raise;
    when sqlstate 'P0008' then raise;
    when sqlstate 'P0009' then raise;
    when others then
        raise exception 'Failed to append schedule epoch: %', sqlerrm using errcode = 'P0099';
end;
$$;

revoke all on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer
) from public;
grant execute on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer
) to authenticated;

-- Re-own the SECURITY DEFINER functions to the habits table owner so the
-- guard allows the RPC/seed writes and RLS behaves as intended. Skipped when
-- the owner already matches (the normal Supabase case).
do $$
declare
    v_owner name;
    v_func_owner name;
    v_fn text;
begin
    select pg_get_userbyid(c.relowner)
      into v_owner
      from pg_class c
     where c.oid = 'public.habits'::regclass;

    foreach v_fn in array array[
        'public.append_habit_schedule_epoch(uuid, text, smallint, integer, integer)',
        'public.seed_habit_schedule_history()'
    ]
    loop
        select pg_get_userbyid(p.proowner)
          into v_func_owner
          from pg_proc p
         where p.oid = to_regprocedure(v_fn);

        if v_func_owner is not null and v_func_owner is distinct from v_owner then
            execute format('alter function %s owner to %I', v_fn, v_owner);
        end if;
    end loop;
end $$;

commit;

-- ============================================================
-- 7. POST-MIGRATION VERIFICATION (read-only)
-- ============================================================
-- Expected on the known production data:
--   select schedule_type, count(*) from public.habits group by 1;
--   -- daily: 22, legacy: 2
--
--   select count(*) from public.habit_schedule_history;
--   -- 24 (one initial epoch per existing habit)
--
--   select h.id, h.freq_times, h.freq_days, h.schedule_type,
--          e.legacy_freq_times, e.legacy_freq_days
--     from public.habits h
--     join public.habit_schedule_history e
--       on e.habit_id = h.id
--    where h.freq_times <> 1 or h.freq_days <> 1;
--   -- the 5/1 row keeps 5/1 in both habit and epoch; the 1/2 row keeps 1/2
--
--   select count(*) from public.entries;
--   -- must be unchanged from the preflight count
--
-- ============================================================
-- 8. MANUAL ROLLBACK / RECOVERY (only if needed; not part of this migration)
-- ============================================================
-- The forward migration is transactional: any error before COMMIT rolls back
-- all DDL and backfill automatically. The original habits and entries are not
-- modified except for the new schedule columns.
--
-- If a committed rollback is required, take a backup first. If 20261114 and
-- 20261115 have already been applied, revert them first; otherwise dropping
-- the base objects would break their functions/triggers. Then:
--
-- begin;
-- drop trigger if exists habits_seed_schedule_history on public.habits;
-- drop trigger if exists habits_guard_schedule_columns on public.habits;
-- drop trigger if exists habits_normalize_schedule on public.habits;
-- drop function if exists public.append_habit_schedule_epoch(uuid, text, smallint, integer, integer);
-- drop function if exists public.seed_habit_schedule_history();
-- drop function if exists public.guard_habit_schedule_columns();
-- drop function if exists public.normalize_habit_schedule();
-- drop table if exists public.habit_schedule_history;
-- alter table public.habits drop constraint if exists habits_freq_mirror_ck;
-- alter table public.habits drop constraint if exists habits_schedule_shape;
-- alter table public.habits
--     drop column if exists schedule_type,
--     drop column if exists scheduled_days,
--     drop column if exists interval_days,
--     drop column if exists weekly_target;
-- commit;
--
-- Dropping the history table discards only schedule epochs (which did not
-- exist before this migration). Habits, entries, users, vacation periods and
-- profiles are untouched. Restore from the pre-migration backup/PITR if the
-- rollback itself is suspected or if later migrations already wrote epochs.
