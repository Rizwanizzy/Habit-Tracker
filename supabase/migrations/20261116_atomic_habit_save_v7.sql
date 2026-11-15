BEGIN;

-- Apply only after the existing v7 base, custom RPC, same-day fix, and
-- row-lock/search_path hardening of append_habit_schedule_epoch.
-- A PostgreSQL function call is one transaction: any failure rolls back
-- both the schedule epoch and habit details.
create or replace function public.save_habit_with_schedule_v7(
  p_habit_id uuid,
  p_details jsonb,
  p_schedule jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_habit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize details-only and schedule-changing saves for the same habit.
  select h.id into v_habit_id
    from public.habits h
   where h.id = p_habit_id and h.user_id = auth.uid()
   for update;
  if not found then
    raise exception 'Habit not found or access denied' using errcode = '42501';
  end if;

  if p_details is null
     or jsonb_typeof(p_details) <> 'object'
     or (select count(*) from jsonb_object_keys(p_details)) <> 6
     or not (p_details ?& array['name','type','target','unit','color','emoji']) then
    raise exception 'Invalid habit details payload' using errcode = '22023';
  end if;

  if p_schedule is not null then
    if jsonb_typeof(p_schedule) <> 'object'
       or not (p_schedule ? 'schedule_type') then
      raise exception 'Invalid schedule payload' using errcode = '22023';
    end if;
    perform public.append_habit_schedule_epoch(
      p_habit_id,
      p_schedule->>'schedule_type',
      (p_schedule->>'scheduled_days')::smallint,
      (p_schedule->>'interval_days')::integer,
      (p_schedule->>'weekly_target')::integer,
      (p_schedule->>'legacy_freq_times')::integer,
      (p_schedule->>'legacy_freq_days')::integer
    );
  end if;

  update public.habits h
     set name = p_details->>'name',
         type = p_details->>'type',
         target = (p_details->>'target')::numeric,
         unit = p_details->>'unit',
         color = p_details->>'color',
         emoji = p_details->>'emoji'
   where h.id = p_habit_id and h.user_id = auth.uid();
  if not found then
    raise exception 'Habit disappeared during save' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.save_habit_with_schedule_v7(uuid,jsonb,jsonb) from public;
revoke all on function public.save_habit_with_schedule_v7(uuid,jsonb,jsonb) from anon;
grant execute on function public.save_habit_with_schedule_v7(uuid,jsonb,jsonb) to authenticated;

COMMIT;
