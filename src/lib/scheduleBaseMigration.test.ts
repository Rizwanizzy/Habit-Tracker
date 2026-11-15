import { describe, expect, it } from 'vitest'
import sql from '../../supabase/migrations/20261113_schedule_base_v7.sql?raw'

describe('base v7 scheduling migration', () => {
  it('classifies 1/1 as daily and every other frequency as legacy', () => {
    expect(sql).toContain("when freq_times = 1 and freq_days = 1 then 'daily'")
    expect(sql).toContain("else 'legacy'")
  })

  it('preserves exact legacy snapshots without Custom bounds', () => {
    expect(sql).toContain("when h.schedule_type = 'legacy' then h.freq_times else null end")
    expect(sql).toContain("when h.schedule_type = 'legacy' then h.freq_days else null end")

    // 5/1 is deliberately valid for legacy; only 20261114 adds the Custom
    // times<=days bound.
    expect(sql).not.toContain('freq_times <= freq_days')
    expect(sql).not.toContain('legacy_freq_times <= legacy_freq_days')
  })

  it('uses the three trigger names expected by 20261114', () => {
    expect(sql).toContain('habits_normalize_schedule')
    expect(sql).toContain('habits_guard_schedule_columns')
    expect(sql).toContain('habits_seed_schedule_history')
  })

  it('declares the original 5-argument RPC that 20261114 drops', () => {
    expect(sql).toContain('drop function if exists public.append_habit_schedule_epoch')
    expect(sql).toContain('p_scheduled_days smallint default null')
    expect(sql).toContain('p_interval_days integer default null')
    expect(sql).toContain('p_weekly_target integer default null')
  })

  it('aborts instead of replacing an existing scheduling schema', () => {
    expect(sql).toContain('scheduling objects already exist')
    expect(sql).toContain("column_name = 'schedule_type'")
    expect(sql).toContain("to_regclass('public.habit_schedule_history')")
  })
})
