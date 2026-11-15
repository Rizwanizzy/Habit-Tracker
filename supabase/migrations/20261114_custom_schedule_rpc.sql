-- Staging migration: editable Custom schedules (Stage 4F) — corrected for the
-- confirmed staging constraint names.
--
-- Scope of this file (staging only, transactional, additive, re-runnable):
--   1. Replace the 5-parameter append_habit_schedule_epoch RPC with a
--      7-parameter version that accepts Custom (Times / Per Days).
--   2. Explicitly replace the four existing CHECK constraints by name and
--      add the `custom` branch. No pg_constraint scanning / string surgery.
--   3. Add two NARROW, additive triggers so a brand-new Custom habit gets a
--      valid initial history epoch. The three existing triggers
--      (habits_normalize_schedule, habits_guard_schedule_columns,
--      habits_seed_schedule_history) are NOT dropped, replaced or modified.
--
-- Confirmed staging facts respected here:
--   * habits_normalize_schedule → normalize_habit_schedule() (BEFORE INSERT,
--     daily→legacy only when freq != 1/1). Untouched.
--   * habits_guard_schedule_columns → guard_habit_schedule_columns()
--     (schedule columns only writable by the habits table owner). Untouched;
--     the SECURITY DEFINER functions below are re-owned to that owner.
--   * habits_seed_schedule_history → seed_habit_schedule_history() (logical
--     day via Asia/Kolkata + user_settings.day_start_hour; only fills the
--     freq snapshot for `legacy`). Untouched.
--   * habit_schedule_history rows carry user_id.
--
-- PRE-FLIGHT (run separately, read-only) — compare the current definitions to
-- the branch bodies in section 3 before applying:
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid in ('public.habits'::regclass,
--                       'public.habit_schedule_history'::regclass)
--      and conname in ('habits_freq_mirror_ck', 'habits_schedule_shape',
--                      'habit_schedule_history_shape',
--                      'habit_schedule_history_type_ck')
--    order by conrelid, conname;
--
-- No data is deleted. Existing legacy epochs and their frequencies are never
-- rewritten or newly bounded.

begin;

-- ============================================================
-- 1. DROP THE OLD 5-PARAMETER RPC (prevents overload ambiguity)
-- ============================================================
drop function if exists public.append_habit_schedule_epoch(
    uuid,       -- p_habit_id
    text,       -- p_schedule_type
    smallint,   -- p_scheduled_days (actual staging arity)
    integer,    -- p_interval_days
    integer     -- p_weekly_target
);

-- ============================================================
-- 2. CREATE THE 7-PARAMETER RPC (custom support, v7 semantics preserved)
-- ============================================================
create or replace function public.append_habit_schedule_epoch(
    p_habit_id uuid,
    p_schedule_type text,                       -- daily | weekdays | interval | weekly_target | custom
    p_scheduled_days smallint default null,     -- weekday bitmask (weekdays)
    p_interval_days integer default null,       -- N (interval, >= 2)
    p_weekly_target integer default null,       -- M (weekly_target, 1..7)
    p_legacy_freq_times integer default null,   -- X (custom)
    p_legacy_freq_days integer default null     -- Y (custom)
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
    -- 1. Ownership check (unchanged from v7)
    select * into v_habit
    from public.habits
    where id = p_habit_id
      and user_id = auth.uid();

    if not found then
        raise exception 'Habit not found or access denied' using errcode = 'P0001';
    end if;

    -- 2. schedule_type whitelist (extends v7 with 'custom')
    if p_schedule_type not in ('daily', 'weekdays', 'interval', 'weekly_target', 'custom') then
        raise exception 'Invalid schedule_type: %', p_schedule_type using errcode = 'P0002';
    end if;

    -- 3. Per-mode validation + freq mirror (v7 rules, plus custom)
    case p_schedule_type
        when 'daily' then
            if p_scheduled_days is not null or p_interval_days is not null or p_weekly_target is not null
               or p_legacy_freq_times is not null or p_legacy_freq_days is not null then
                raise exception 'Daily habits do not take weekday, interval, weekly-target or custom frequency values.' using errcode = 'P0003';
            end if;
            v_freq_times := 1;
            v_freq_days := 1;

        when 'weekdays' then
            if p_scheduled_days is null or p_scheduled_days < 1 or p_scheduled_days > 127 then
                raise exception 'Pick at least one day of the week.' using errcode = 'P0004';
            end if;
            if p_interval_days is not null or p_weekly_target is not null
               or p_legacy_freq_times is not null or p_legacy_freq_days is not null then
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
            if p_scheduled_days is not null or p_weekly_target is not null
               or p_legacy_freq_times is not null or p_legacy_freq_days is not null then
                raise exception 'Interval schedules take a day interval only.' using errcode = 'P0007';
            end if;
            v_freq_times := 1;
            v_freq_days := p_interval_days;

        when 'weekly_target' then
            if p_weekly_target is null or p_weekly_target < 1 or p_weekly_target > 7 then
                raise exception 'The weekly target must be 1 to 7 times a week.' using errcode = 'P0008';
            end if;
            if p_scheduled_days is not null or p_interval_days is not null
               or p_legacy_freq_times is not null or p_legacy_freq_days is not null then
                raise exception 'Weekly-target schedules take a weekly target only.' using errcode = 'P0009';
            end if;
            v_freq_times := p_weekly_target;
            v_freq_days := 7;

        when 'custom' then
            if p_scheduled_days is not null or p_interval_days is not null or p_weekly_target is not null then
                raise exception 'Custom schedules take Times and Per Days only.' using errcode = 'P0014';
            end if;
            if p_legacy_freq_times is null or p_legacy_freq_times < 1 then
                raise exception 'Custom schedule requires Times >= 1.' using errcode = 'P0010';
            end if;
            if p_legacy_freq_days is null or p_legacy_freq_days < 1 then
                raise exception 'Custom schedule requires Per Days >= 1.' using errcode = 'P0011';
            end if;
            if p_legacy_freq_times > p_legacy_freq_days then
                raise exception 'Times cannot exceed Per Days.' using errcode = 'P0012';
            end if;
            if p_legacy_freq_days > 31 then
                raise exception 'Per Days cannot exceed 31.' using errcode = 'P0013';
            end if;
            v_freq_times := p_legacy_freq_times;
            v_freq_days := p_legacy_freq_days;
    end case;

    -- 4. Logical day — MATCHES seed_habit_schedule_history():
    --    Asia/Kolkata local date shifted back by the user's day_start_hour.
    select coalesce(us.day_start_hour, 0)
      into v_day_start
      from public.user_settings us
     where us.user_id = auth.uid();

    if v_day_start is null then
        v_day_start := 0;
    end if;

    v_effective_from :=
        ((now() at time zone 'Asia/Kolkata') - make_interval(hours => v_day_start))::date;

    -- 5. Same-day coalescing (final-wins). Next logical day appends a new epoch.
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
            legacy_freq_times = p_legacy_freq_times,
            legacy_freq_days  = p_legacy_freq_days
        where habit_id = p_habit_id
          and effective_from = v_effective_from;
    else
        -- user_id is required by the history table (seeded epochs carry it).
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
            p_legacy_freq_times,
            p_legacy_freq_days
        );
    end if;

    -- 6. Sync the habit row (owner-only guard permits this; see 4b).
    --    The staging habits table has no updated_at column, so only the
    --    schedule columns and the frequency mirror are written here.
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
    when sqlstate 'P0010' then raise;
    when sqlstate 'P0011' then raise;
    when sqlstate 'P0012' then raise;
    when sqlstate 'P0013' then raise;
    when sqlstate 'P0014' then raise;
    when others then
        raise exception 'Failed to append schedule epoch: %', sqlerrm using errcode = 'P0099';
end;
$$;

-- 2a. Privileges: authenticated only (anon/public lose access). Done while
--     the creating role still owns the function; ACLs survive 4b's re-own.
revoke all on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer, integer, integer
) from public;
grant execute on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer, integer, integer
) to authenticated;

-- ============================================================
-- 3. REPLACE THE FOUR CONFIRMED CHECK CONSTRAINTS (explicit names)
-- ============================================================
-- Confirmed staging constraint names and shape (CASE schedule_type ... ELSE
-- false END). Dropped/recreated by name so `custom` is accepted without any
-- catalog scanning. Each ADD revalidates existing rows, which is safe because
-- the old constraints were already enforced.
--
-- Legacy is deliberately NOT narrowed: no upper bound on freq_times/freq_days,
-- no times<=days comparison, so historical values like 5 times / 90 days stay
-- valid.

-- 3.1 public.habits.habits_freq_mirror_ck
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
            when 'custom' then
                freq_times >= 1
                and freq_days >= 1
                and freq_times <= freq_days
                and freq_days <= 31
            else false
        end
    );

-- 3.2 public.habits.habits_schedule_shape
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
            when 'custom' then
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
            else false
        end
    );

-- 3.3 public.habit_schedule_history.habit_schedule_history_shape
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
                -- Historical legacy validation preserved: non-NULL snapshot
                -- with >= 1 floors, no upper bounds and no times<=days check.
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
                and legacy_freq_times is not null
                and legacy_freq_days is not null
                and legacy_freq_times >= 1
                and legacy_freq_days >= 1
            when 'custom' then
                scheduled_days is null
                and interval_days is null
                and weekly_target is null
                and legacy_freq_times is not null
                and legacy_freq_days is not null
                and legacy_freq_times >= 1
                and legacy_freq_days >= 1
                and legacy_freq_times <= legacy_freq_days
                and legacy_freq_days <= 31
            else false
        end
    );

-- 3.4 public.habit_schedule_history.habit_schedule_history_type_ck
alter table public.habit_schedule_history
    drop constraint if exists habit_schedule_history_type_ck;

alter table public.habit_schedule_history
    add constraint habit_schedule_history_type_ck
    check (
        schedule_type in ('daily', 'weekdays', 'interval', 'weekly_target', 'legacy', 'custom')
    );

-- ============================================================
-- 4. CUSTOM HABIT CREATION SUPPORT (narrow, additive triggers only)
-- ============================================================
-- seed_habit_schedule_history() only fills the legacy freq snapshot for
-- `legacy`, so a brand-new Custom habit would otherwise get a `custom`
-- history epoch with NULL legacy_freq_* and violate 3.3. Two additive
-- triggers fix that without touching any existing trigger/function:
--
-- 4a. history BEFORE INSERT: for `custom` rows, backfill NULL legacy_freq_*
--     from the parent habit's freq mirror (frontend creation sends
--     freq_times/freq_days for Custom).
create or replace function public.fill_custom_schedule_history_freq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_times integer;
    v_days integer;
begin
    if new.schedule_type = 'custom'
       and (new.legacy_freq_times is null or new.legacy_freq_days is null) then
        select h.freq_times, h.freq_days
          into v_times, v_days
          from public.habits h
         where h.id = new.habit_id;

        if new.legacy_freq_times is null then
            new.legacy_freq_times := v_times;
        end if;
        if new.legacy_freq_days is null then
            new.legacy_freq_days := v_days;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists habit_schedule_history_fill_custom_freq
    on public.habit_schedule_history;

create trigger habit_schedule_history_fill_custom_freq
    before insert on public.habit_schedule_history
    for each row
    execute function public.fill_custom_schedule_history_freq();

-- 4b. habits AFTER INSERT (runs after habits_seed_schedule_history because
--     same-timing triggers fire in name order): if the seeder did not create
--     any epoch for a new Custom habit, create the initial Custom epoch at
--     the same logical day the seeder uses.
create or replace function public.ensure_custom_schedule_epoch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_day_start integer := 0;
    v_effective_from date;
begin
    if new.schedule_type is distinct from 'custom' then
        return new;
    end if;

    if exists (
        select 1 from public.habit_schedule_history where habit_id = new.id
    ) then
        return new;
    end if;

    select coalesce(us.day_start_hour, 0)
      into v_day_start
      from public.user_settings us
     where us.user_id = new.user_id;

    if v_day_start is null then
        v_day_start := 0;
    end if;

    v_effective_from :=
        ((now() at time zone 'Asia/Kolkata') - make_interval(hours => v_day_start))::date;

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
        'custom',
        null,
        null,
        null,
        new.freq_times,
        new.freq_days
    );

    return new;
end;
$$;

drop trigger if exists zz_ensure_custom_schedule_epoch on public.habits;

create trigger zz_ensure_custom_schedule_epoch
    after insert on public.habits
    for each row
    execute function public.ensure_custom_schedule_epoch();

-- 4c. Re-own the SECURITY DEFINER functions to the habits table owner so the
--     owner-only guard and RLS behave exactly as intended. Skipped when the
--     owner already matches (the normal Supabase case).
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
        'public.append_habit_schedule_epoch(uuid, text, smallint, integer, integer, integer, integer)',
        'public.fill_custom_schedule_history_freq()',
        'public.ensure_custom_schedule_epoch()'
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

-- ============================================================
-- 5. VERIFICATION QUERIES (read-only unless a line is uncommented)
-- ============================================================
-- 5.1 RPC signature (expect exactly one row with 7 arguments):
--   select p.proname, pg_get_function_arguments(p.oid)
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname = 'append_habit_schedule_epoch';
--
-- 5.2 Function owners equal the habits table owner (guard precondition):
--   select p.proname,
--          pg_get_userbyid(p.proowner) as func_owner,
--          pg_get_userbyid(c.relowner) as table_owner
--     from pg_proc p
--     cross join pg_class c
--    where c.oid = 'public.habits'::regclass
--      and p.pronamespace = 'public'::regnamespace
--      and p.proname in ('append_habit_schedule_epoch',
--                        'fill_custom_schedule_history_freq',
--                        'ensure_custom_schedule_epoch');
--   -- expect func_owner = table_owner for every row
--
-- 5.3 Existing triggers untouched (three rows, plus our two new names):
--   select t.tgname, p.proname as fn
--     from pg_trigger t
--     join pg_proc p on p.oid = t.tgfoid
--    where t.tgrelid = 'public.habits'::regclass
--    order by t.tgname;
--   -- expect habits_guard_schedule_columns, habits_normalize_schedule,
--   --        habits_seed_schedule_history, zz_ensure_custom_schedule_epoch
--   select t.tgname, p.proname as fn
--     from pg_trigger t
--     join pg_proc p on p.oid = t.tgfoid
--    where t.tgrelid = 'public.habit_schedule_history'::regclass
--    order by t.tgname;
--   -- expect habit_schedule_history_fill_custom_freq
--
-- 5.4 The four constraints now mention 'custom' (names + defs):
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid in ('public.habits'::regclass,
--                       'public.habit_schedule_history'::regclass)
--      and conname in ('habits_freq_mirror_ck', 'habits_schedule_shape',
--                      'habit_schedule_history_shape',
--                      'habit_schedule_history_type_ck')
--    order by conrelid, conname;
--
-- 5.5 A new Custom habit gets a valid initial epoch (commented; test user):
--   -- insert into public.habits (user_id, name, type, target, unit, freq_times,
--   --                            freq_days, color, schedule_type)
--   -- values (auth.uid(), 'Custom test', 'boolean', 1, '', 3, 7, '#22c55e', 'custom')
--   -- returning id;
--   -- select schedule_type, legacy_freq_times, legacy_freq_days, effective_from
--   --   from public.habit_schedule_history where habit_id = '<habit-uuid>';
--   -- expect schedule_type='custom', legacy_freq_times=3, legacy_freq_days=7
--
-- 5.6 SAME-DAY final-wins (run twice in one logical day):
--   -- select public.append_habit_schedule_epoch('<habit-uuid>', 'custom', null, null, null, 3, 7);
--   -- select public.append_habit_schedule_epoch('<habit-uuid>', 'custom', null, null, null, 4, 7);
--   -- select count(*) from public.habit_schedule_history
--   --  where habit_id='<habit-uuid>' and effective_from = <current logical date>;
--   -- expect exactly 1 row for that date with legacy_freq_times=4
--
-- 5.7 NEXT LOGICAL DAY appends a new epoch:
--   -- (repeat the edit through the RPC after the logical day rolls over)
--   -- select count(*) from public.habit_schedule_history where habit_id='<habit-uuid>';
--   -- expect previous count + 1 with a NEW effective_from
--
-- 5.8 Legacy -> Custom preserves the legacy epoch:
--   -- select public.append_habit_schedule_epoch('<legacy-habit-uuid>', 'custom', null, null, null, 2, 7);
--   -- select schedule_type, legacy_freq_times, legacy_freq_days, effective_from
--   --   from public.habit_schedule_history where habit_id='<legacy-habit-uuid>'
--   --  order by effective_from;
--   -- expect the original legacy row(s) unchanged + one new custom row
--
-- 5.9 Historical legacy frequencies are not narrowed (read-only):
--   -- select count(*) from public.habit_schedule_history
--   --  where schedule_type='legacy' and legacy_freq_days > 31;
--   -- expect the historical value still present
--
-- 5.10 Direct habit freq writes are still blocked by the owner-only guard:
--   -- update public.habits set freq_times = 99 where id='<habit-uuid>';
--   -- expect guard_habit_schedule_columns to reject a non-owner session
--
-- 5.11 RPC permissions:
--   -- select has_function_privilege('authenticated',
--   --   'public.append_habit_schedule_epoch(uuid,text,smallint,integer,integer,integer,integer)',
--   --   'execute');  -- expect true
--   -- select has_function_privilege('anon',
--   --   'public.append_habit_schedule_epoch(uuid,text,smallint,integer,integer,integer,integer)',
--   --   'execute');  -- expect false

commit;

-- ============================================================
-- 6. ROLLBACK (manual, outside this transaction, if ever needed)
-- ============================================================
-- drop trigger if exists habit_schedule_history_fill_custom_freq on public.habit_schedule_history;
-- drop trigger if exists zz_ensure_custom_schedule_epoch on public.habits;
-- drop function if exists public.fill_custom_schedule_history_freq();
-- drop function if exists public.ensure_custom_schedule_epoch();
-- drop function if exists public.append_habit_schedule_epoch(uuid, text, smallint, integer, integer, integer, integer);
-- -- Re-create the four v7 constraints from the pre-flight definitions captured
-- -- before applying (section 3 drops them), then re-create the v7 5-parameter
-- -- RPC and its grants.
-- -- No rows are modified by the forward migration: the existing triggers,
-- -- habit frequencies and history rows are untouched.
