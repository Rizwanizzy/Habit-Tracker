-- Regression test: a legacy epoch must not be overwritten by same-day
-- coalescing. Run only on a disposable Supabase/Postgres clone. The whole
-- test runs in a transaction and ends with ROLLBACK.
--
-- Requires at least one row in auth.users (used as the habit owner) and the
-- scheduling migration/RPC already applied.

begin;

do $$
declare
    v_user uuid;
    v_legacy_habit uuid;
    v_custom_habit uuid;
    v_today date;
    v_day_start integer := 0;
    v_epoch record;
    v_count integer;
    v_legacy_rejected boolean := false;
begin
    select id into v_user
      from auth.users
     order by created_at
     limit 1;

    if v_user is null then
        raise exception 'Regression test needs at least one auth.users row';
    end if;

    -- Make auth.uid() resolve to the test owner for this transaction.
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

    v_today := ((now() at time zone 'Asia/Kolkata')
                - make_interval(hours => v_day_start))::date;

    -- 1. Legacy epoch on today's logical date.
    insert into public.habits (
        user_id, name, type, target, freq_times, freq_days, color, schedule_type
    ) values (
        v_user, 'Legacy same-day regression', 'boolean', 1, 3, 7, '#3B82F6', 'legacy'
    )
    returning id into v_legacy_habit;

    delete from public.habit_schedule_history where habit_id = v_legacy_habit;
    insert into public.habit_schedule_history (
        habit_id, user_id, effective_from, schedule_type,
        scheduled_days, interval_days, weekly_target,
        legacy_freq_times, legacy_freq_days
    ) values (
        v_legacy_habit, v_user, v_today, 'legacy',
        null, null, null, 3, 7
    );

    -- The edit must be rejected, not coalesced over the legacy epoch.
    -- Only a P0001 rejection counts as success; an unexpected successful RPC
    -- leaves the flag false and fails after the handler.
    begin
        perform public.append_habit_schedule_epoch(
            v_legacy_habit, 'custom', null, null, null, 4, 7
        );
    exception
        when sqlstate 'P0001' then
            v_legacy_rejected := true;
    end;

    if not v_legacy_rejected then
        raise exception 'Expected legacy same-day overwrite to be rejected';
    end if;

    select * into v_epoch
      from public.habit_schedule_history
     where habit_id = v_legacy_habit
       and effective_from = v_today;

    if not found then
        raise exception 'Legacy epoch disappeared';
    end if;
    if v_epoch.schedule_type <> 'legacy'
       or v_epoch.legacy_freq_times <> 3
       or v_epoch.legacy_freq_days <> 7 then
        raise exception 'Legacy epoch changed: %', row_to_json(v_epoch);
    end if;

    select count(*) into v_count
      from public.habit_schedule_history
     where habit_id = v_legacy_habit
       and effective_from = v_today;
    if v_count <> 1 then
        raise exception 'Expected exactly one legacy epoch, found %', v_count;
    end if;

    if (select schedule_type from public.habits where id = v_legacy_habit) <> 'legacy' then
        raise exception 'Habit row changed despite rejected edit';
    end if;

    -- 2. Normal non-legacy same-day coalescing still works.
    insert into public.habits (
        user_id, name, type, target, freq_times, freq_days, color, schedule_type
    ) values (
        v_user, 'Custom coalescing regression', 'boolean', 1, 5, 7, '#22C55E', 'custom'
    )
    returning id into v_custom_habit;

    delete from public.habit_schedule_history where habit_id = v_custom_habit;
    insert into public.habit_schedule_history (
        habit_id, user_id, effective_from, schedule_type,
        scheduled_days, interval_days, weekly_target,
        legacy_freq_times, legacy_freq_days
    ) values (
        v_custom_habit, v_user, v_today, 'custom',
        null, null, null, 5, 7
    );

    perform public.append_habit_schedule_epoch(
        v_custom_habit, 'custom', null, null, null, 6, 7
    );

    select * into v_epoch
      from public.habit_schedule_history
     where habit_id = v_custom_habit
       and effective_from = v_today;

    if not found then
        raise exception 'Custom epoch disappeared';
    end if;
    if v_epoch.schedule_type <> 'custom'
       or v_epoch.legacy_freq_times <> 6
       or v_epoch.legacy_freq_days <> 7 then
        raise exception 'Custom same-day coalescing failed: %', row_to_json(v_epoch);
    end if;

    select count(*) into v_count
      from public.habit_schedule_history
     where habit_id = v_custom_habit
       and effective_from = v_today;
    if v_count <> 1 then
        raise exception 'Expected exactly one custom epoch, found %', v_count;
    end if;

    raise notice 'Legacy same-day overwrite regression test passed';
end $$;

rollback;
