-- Base v7 scheduling regression test.
--
-- Run only on a disposable Supabase/Postgres clone with
-- 20261113_schedule_base_v7.sql applied. The whole test runs in a transaction
-- and ends with ROLLBACK.
--
-- It verifies the classification/seed path that the base migration relies on:
--   * 1/1 habits become daily;
--   * 5/1 and 1/2 habits become legacy with the exact frozen frequency;
--   * legacy history allows 5/1 (times > days), unlike Custom;
--   * the initial epoch uses the same Asia/Kolkata + day_start_hour logical
--     date as the app;
--   * exactly one history epoch is seeded per test habit.

begin;

do $$
declare
    v_user uuid;
    v_day_start integer := 0;
    v_effective_from date;
    v_five_one_habit uuid;
    v_one_two_habit uuid;
    v_daily_habit uuid;
    v_epoch record;
    v_count integer;
begin
    select id into v_user
      from auth.users
     order by created_at
     limit 1;

    if v_user is null then
        raise exception 'Regression test needs at least one auth.users row';
    end if;

    -- Make auth.uid() resolve to the test owner for this transaction so the
    -- seed trigger's user_id and the history RLS policy line up.
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', v_user)::text,
        true
    );

    select coalesce(day_start_hour, 0)
      into v_day_start
      from public.user_settings
     where user_id = v_user;

    if v_day_start is null then
        v_day_start := 0;
    end if;

    v_effective_from :=
        ((timestamptz '2026-01-15 02:00:00+05:30' at time zone 'Asia/Kolkata')
            - make_interval(hours => v_day_start))::date;

    -- 5/1: omit schedule_type, exactly like a pre-scheduling client insert.
    insert into public.habits (
        user_id, name, type, target, freq_times, freq_days, color, created_at
    ) values (
        v_user, 'Base v7 5/1 legacy', 'boolean', 1, 5, 1, '#3B82F6',
        timestamptz '2026-01-15 02:00:00+05:30'
    )
    returning id into v_five_one_habit;

    -- 1/2: explicit daily must still normalize to legacy because freq != 1/1.
    insert into public.habits (
        user_id, name, type, target, freq_times, freq_days, color, created_at,
        schedule_type
    ) values (
        v_user, 'Base v7 1/2 legacy', 'boolean', 1, 1, 2, '#22C55E',
        timestamptz '2026-01-15 02:00:00+05:30', 'daily'
    )
    returning id into v_one_two_habit;

    -- 1/1: remains daily.
    insert into public.habits (
        user_id, name, type, target, freq_times, freq_days, color, created_at
    ) values (
        v_user, 'Base v7 daily', 'boolean', 1, 1, 1, '#F59E0B',
        timestamptz '2026-01-15 02:00:00+05:30'
    )
    returning id into v_daily_habit;

    -- 5/1 legacy must keep both the habit mirror and the frozen snapshot.
    select h.schedule_type,
           h.scheduled_days,
           h.interval_days,
           h.weekly_target
      into v_epoch
      from public.habits h
     where h.id = v_five_one_habit;

    if v_epoch.schedule_type <> 'legacy'
       or v_epoch.scheduled_days is not null
       or v_epoch.interval_days is not null
       or v_epoch.weekly_target is not null then
        raise exception '5/1 habit was not classified as null-param legacy: %',
            row_to_json(v_epoch);
    end if;

    select * into v_epoch
      from public.habit_schedule_history
     where habit_id = v_five_one_habit;

    if not found then
        raise exception '5/1 habit has no initial history epoch';
    end if;
    if v_epoch.schedule_type <> 'legacy'
       or v_epoch.effective_from <> v_effective_from
       or v_epoch.legacy_freq_times <> 5
       or v_epoch.legacy_freq_days <> 1 then
        raise exception '5/1 legacy snapshot was not preserved: %',
            row_to_json(v_epoch);
    end if;

    select count(*) into v_count
      from public.habit_schedule_history
     where habit_id = v_five_one_habit;
    if v_count <> 1 then
        raise exception '5/1 habit expected one epoch, found %', v_count;
    end if;

    -- 1/2 legacy must keep its exact snapshot too.
    select * into v_epoch
      from public.habit_schedule_history
     where habit_id = v_one_two_habit;

    if not found then
        raise exception '1/2 habit has no initial history epoch';
    end if;
    if v_epoch.schedule_type <> 'legacy'
       or v_epoch.effective_from <> v_effective_from
       or v_epoch.legacy_freq_times <> 1
       or v_epoch.legacy_freq_days <> 2 then
        raise exception '1/2 legacy snapshot was not preserved: %',
            row_to_json(v_epoch);
    end if;

    if (select schedule_type from public.habits where id = v_one_two_habit) <> 'legacy' then
        raise exception '1/2 habit row was not reclassified to legacy';
    end if;

    select count(*) into v_count
      from public.habit_schedule_history
     where habit_id = v_one_two_habit;
    if v_count <> 1 then
        raise exception '1/2 habit expected one epoch, found %', v_count;
    end if;

    -- 1/1 must stay daily and have no legacy snapshot.
    select * into v_epoch
      from public.habit_schedule_history
     where habit_id = v_daily_habit;

    if not found then
        raise exception 'Daily habit has no initial history epoch';
    end if;
    if v_epoch.schedule_type <> 'daily'
       or v_epoch.effective_from <> v_effective_from
       or v_epoch.legacy_freq_times is not null
       or v_epoch.legacy_freq_days is not null then
        raise exception 'Daily initial epoch is wrong: %', row_to_json(v_epoch);
    end if;

    if (select schedule_type from public.habits where id = v_daily_habit) <> 'daily' then
        raise exception '1/1 habit was not classified as daily';
    end if;

    select count(*) into v_count
      from public.habit_schedule_history
     where habit_id = v_daily_habit;
    if v_count <> 1 then
        raise exception 'Daily habit expected one epoch, found %', v_count;
    end if;

    raise notice 'Base v7 scheduling regression test passed';
end $$;

rollback;
