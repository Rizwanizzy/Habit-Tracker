-- Fix: never overwrite a legacy schedule-history epoch on the same logical day.
--
-- Production already has the 7-argument append_habit_schedule_epoch RPC from
-- 20261114. This migration only replaces that function body; it does not
-- create tables, change constraints/triggers, or modify existing rows.
--
-- Why this is needed:
--   Same-day coalescing updates the existing (habit_id, effective_from) row.
--   If that row is a `legacy` epoch, the UPDATE replaces the frozen legacy
--   frequency snapshot with the new schedule. The unique constraint
--   (habit_id, effective_from) means the legacy row and a new epoch cannot
--   coexist on the same date. Reject the edit instead of destroying history;
--   the user can retry on the next logical day.

begin;

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
set search_path = ''
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
      and user_id = auth.uid()
    for update;

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

    -- 4. Logical day â€” MATCHES seed_habit_schedule_history():
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

    -- 5. Same-day coalescing (final-wins): normal schedule edits update the
    --    existing epoch for today, while a new logical day appends a new one.
    --    A legacy row is different: it is the frozen pre-scheduling snapshot.
    --    The unique (habit_id, effective_from) constraint prevents it from
    --    coexisting with a new epoch on the same date, so reject the edit
    --    instead of overwriting history.
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

-- Preserve the existing production ACLs.
revoke all on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer, integer, integer
) from public;
revoke all on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer, integer, integer
) from anon;
grant execute on function public.append_habit_schedule_epoch(
    uuid, text, smallint, integer, integer, integer, integer
) to authenticated;

commit;
