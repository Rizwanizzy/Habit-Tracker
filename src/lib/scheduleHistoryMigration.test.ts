import { describe, expect, it } from 'vitest'
import sql from '../../supabase/migrations/20261115_fix_legacy_same_day_overwrite.sql?raw'

describe('legacy same-day schedule migration', () => {
  it('rejects legacy same-day coalescing before the history UPDATE', () => {
    const guardIndex = sql.indexOf("and schedule_type = 'legacy'")
    expect(guardIndex).toBeGreaterThan(-1)

    const updateIndex = sql.indexOf('update public.habit_schedule_history', guardIndex)
    expect(updateIndex).toBeGreaterThan(guardIndex)
  })

  it('keeps normal same-day coalescing for non-legacy epochs', () => {
    const branchIndex = sql.indexOf('if v_same_day_epoch then')
    expect(branchIndex).toBeGreaterThan(-1)

    const updateIndex = sql.indexOf('update public.habit_schedule_history', branchIndex)
    expect(updateIndex).toBeGreaterThan(branchIndex)

    const elseIndex = sql.indexOf('\n    else\n', updateIndex)
    expect(elseIndex).toBeGreaterThan(updateIndex)
  })

  it('preserves authenticated-only execute privileges', () => {
    expect(sql).toContain('revoke all on function public.append_habit_schedule_epoch')
    expect(sql).toContain('to authenticated')
  })
})
