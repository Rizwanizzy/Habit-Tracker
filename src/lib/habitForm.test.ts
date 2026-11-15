import { describe, it, expect } from 'vitest'
import { FRIDAY, MONDAY, SUNDAY, WEDNESDAY } from './schedule'
import {
  LEGACY_FIXED_EXPLANATION,
  creationScheduleFields,
  draftSchedule,
  draftScheduleLabel,
  formScheduleFromRow,
  loadedScheduleFromRow,
  modeAfterSelection,
  sameSchedule,
  scheduleChanged,
  scheduleModeOptions,
  selectorModeFor,
} from './habitForm'
import { FORM_BLANK, type FormState } from '../types/habit-form'

function form(over: Partial<FormState> = {}): FormState {
  return { ...FORM_BLANK, ...over }
}

describe('draftSchedule (FormState → ScheduleConfig)', () => {
  it('daily / weekdays pass their own value', () => {
    expect(draftSchedule(form({ schedule_mode: 'daily' }))).toEqual({ schedule_type: 'daily' })
    expect(draftSchedule(form({ schedule_mode: 'weekdays', scheduled_days: MONDAY | FRIDAY }))).toEqual({
      schedule_type: 'weekdays',
      scheduled_days: MONDAY | FRIDAY,
    })
  })

  it('interval and weekly_target clamp the string drafts', () => {
    expect(draftSchedule(form({ schedule_mode: 'interval', interval_days: '3' }))).toEqual({
      schedule_type: 'interval',
      interval_days: 3,
    })
    expect(draftSchedule(form({ schedule_mode: 'interval', interval_days: '0' }))).toEqual({
      schedule_type: 'interval',
      interval_days: 2,
    })
    expect(draftSchedule(form({ schedule_mode: 'weekly_target', weekly_target: '9' }))).toEqual({
      schedule_type: 'weekly_target',
      weekly_target: 7,
    })
    expect(draftSchedule(form({ schedule_mode: 'weekly_target', weekly_target: '0' }))).toEqual({
      schedule_type: 'weekly_target',
      weekly_target: 1,
    })
  })

  it('custom keeps the raw numeric draft so non-integers can be rejected', () => {
    expect(
      draftSchedule(form({ schedule_mode: 'custom', freq_times: '3.5', freq_days: '7' })),
    ).toEqual({ schedule_type: 'custom', legacy_freq_times: 3.5, legacy_freq_days: 7 })
  })

  it('legacy and pending-probe drafts are null', () => {
    expect(draftSchedule(form({ schedule_mode: 'legacy' }))).toBeNull()
    expect(draftSchedule(form({ schedule_mode: '' }))).toBeNull()
  })
})

describe('scheduleModeOptions (Add Habit repeat pills)', () => {
  it('always returns exactly the five pills, with an editable Custom', () => {
    const options = scheduleModeOptions()
    expect(options.map((o) => o.key)).toEqual([
      'daily',
      'weekdays',
      'interval',
      'weekly_target',
      'custom',
    ])
    expect(options.find((o) => o.key === 'custom')?.label).toBe('Custom')
    expect(options.some((o) => o.key === 'legacy')).toBe(false)
  })

  it('uses the expected short labels', () => {
    expect(scheduleModeOptions().map((o) => o.short)).toEqual([
      'Daily',
      'Days',
      'N days',
      'Weekly',
      'Custom',
    ])
  })

  it('legacy shows Custom as selected without changing its internal mode', () => {
    expect(selectorModeFor('legacy')).toBe('custom')
    expect(selectorModeFor('custom')).toBe('custom')
    // Choosing Custom while the loaded identity is legacy must NOT convert it.
    expect(modeAfterSelection('custom', true)).toBe('legacy')
    // Selecting another mode replaces the legacy schedule.
    expect(modeAfterSelection('interval', true)).toBe('interval')
    // A genuine/new Custom habit is unaffected.
    expect(modeAfterSelection('custom', false)).toBe('custom')
  })

  it('keeps legacy and Custom internals distinct behind the shared label', () => {
    const legacy = form({ schedule_mode: 'legacy', freq_times: '3', freq_days: '7' })
    const custom = form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' })

    expect(selectorModeFor(legacy.schedule_mode)).toBe('custom')
    expect(selectorModeFor(custom.schedule_mode)).toBe('custom')
    // Only the real Custom mode produces a custom config; legacy stays frozen.
    expect(draftSchedule(legacy)).toBeNull()
    expect(draftSchedule(custom)).toEqual({
      schedule_type: 'custom',
      legacy_freq_times: 3,
      legacy_freq_days: 7,
    })
  })

  it('uses the agreed legacy explanation copy', () => {
    expect(LEGACY_FIXED_EXPLANATION).toBe(
      'This is an older fixed schedule. Choose another repeat option above to change it.',
    )
  })

  it('selecting Custom on a new habit builds the editable custom draft/payload', () => {
    // Regression: the pill used to write schedule_mode 'legacy', which
    // disables the inputs and sends no schedule_type. It must be 'custom'.
    const f = form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' })
    expect(draftSchedule(f)).toEqual({
      schedule_type: 'custom',
      legacy_freq_times: 3,
      legacy_freq_days: 7,
    })
    expect(creationScheduleFields(f, 1, 1)).toEqual({
      freq_times: 3,
      freq_days: 7,
      schedule_type: 'custom',
    })
  })
})

describe('Repeat selector legacy identity across unsaved edits', () => {
  it('legacy → Weekly → Custom restores the locked legacy 3/7', () => {
    // The stable origin flag stays true for the whole unsaved session.
    let f = form({ schedule_mode: 'legacy', freq_times: '3', freq_days: '7' })
    f = { ...f, schedule_mode: 'weekly_target', weekly_target: '4' }
    f = { ...f, schedule_mode: modeAfterSelection('custom', true) }

    expect(f.schedule_mode).toBe('legacy')
    expect(f.freq_times).toBe('3')
    expect(f.freq_days).toBe('7')
    expect(selectorModeFor(f.schedule_mode)).toBe('custom')
    expect(draftSchedule(f)).toBeNull()
    // Leaving and returning without saving is NOT a schedule change.
    expect(
      scheduleChanged(f, {
        schedule_type: 'legacy',
        legacy_freq_times: 3,
        legacy_freq_days: 7,
      }),
    ).toBe(false)
  })

  it('legacy → Weekly → save → Custom becomes an editable modern Custom', () => {
    // After the modern schedule saves, HabitForm clears the origin flag.
    const originallyLegacy = false
    const f = form({
      schedule_mode: modeAfterSelection('custom', originallyLegacy),
      freq_times: '3',
      freq_days: '7',
    })

    expect(f.schedule_mode).toBe('custom')
    expect(draftSchedule(f)).toEqual({
      schedule_type: 'custom',
      legacy_freq_times: 3,
      legacy_freq_days: 7,
    })
  })

  it('genuine Custom → Weekly → Custom stays editable Custom', () => {
    let f = form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' })
    f = { ...f, schedule_mode: 'weekly_target', weekly_target: '4' }
    f = { ...f, schedule_mode: modeAfterSelection('custom', false) }

    expect(f.schedule_mode).toBe('custom')
    expect(draftSchedule(f)).toEqual({
      schedule_type: 'custom',
      legacy_freq_times: 3,
      legacy_freq_days: 7,
    })
  })

  it('new habit → Custom is editable', () => {
    const f = form({
      schedule_mode: modeAfterSelection('custom', false),
      freq_times: '1',
      freq_days: '1',
    })

    expect(f.schedule_mode).toBe('custom')
    expect(draftSchedule(f)).toEqual({
      schedule_type: 'custom',
      legacy_freq_times: 1,
      legacy_freq_days: 1,
    })
  })
})

describe('sameSchedule (per-mode equality)', () => {
  it('each mode equals only itself', () => {
    expect(sameSchedule({ schedule_type: 'daily' }, { schedule_type: 'daily' })).toBe(true)
    expect(sameSchedule({ schedule_type: 'daily' }, { schedule_type: 'weekdays', scheduled_days: 127 })).toBe(false)
    expect(
      sameSchedule(
        { schedule_type: 'weekdays', scheduled_days: MONDAY },
        { schedule_type: 'weekdays', scheduled_days: MONDAY },
      ),
    ).toBe(true)
    expect(
      sameSchedule(
        { schedule_type: 'weekdays', scheduled_days: MONDAY },
        { schedule_type: 'weekdays', scheduled_days: SUNDAY },
      ),
    ).toBe(false)
    expect(
      sameSchedule({ schedule_type: 'interval', interval_days: 3 }, { schedule_type: 'interval', interval_days: 4 }),
    ).toBe(false)
    expect(
      sameSchedule({ schedule_type: 'weekly_target', weekly_target: 3 }, { schedule_type: 'weekly_target', weekly_target: 3 }),
    ).toBe(true)
  })

  it('legacy equals only legacy', () => {
    expect(sameSchedule({ schedule_type: 'legacy' }, { schedule_type: 'legacy' })).toBe(true)
    expect(sameSchedule({ schedule_type: 'legacy' }, { schedule_type: 'daily' })).toBe(false)
  })

  it('null equals only null', () => {
    expect(sameSchedule(null, null)).toBe(true)
    expect(sameSchedule(null, { schedule_type: 'daily' })).toBe(false)
  })
})

describe('scheduleChanged (RPC gating)', () => {
  it('staying on legacy is NOT a change (no silent conversion)', () => {
    const f = form({ schedule_mode: 'legacy' })
    expect(scheduleChanged(f, { schedule_type: 'legacy' })).toBe(false)
    expect(scheduleChanged(f, null)).toBe(false)
  })

  it('switching away from legacy IS a change', () => {
    const f = form({ schedule_mode: 'weekdays', scheduled_days: MONDAY })
    expect(scheduleChanged(f, { schedule_type: 'legacy' })).toBe(true)
  })

  it('untouched non-legacy schedules are unchanged', () => {
    expect(
      scheduleChanged(
        form({ schedule_mode: 'weekdays', scheduled_days: MONDAY | WEDNESDAY }),
        { schedule_type: 'weekdays', scheduled_days: MONDAY | WEDNESDAY },
      ),
    ).toBe(false)
    expect(scheduleChanged(form({ schedule_mode: 'daily' }), { schedule_type: 'daily' })).toBe(false)
    expect(
      scheduleChanged(
        form({ schedule_mode: 'interval', interval_days: '4' }),
        { schedule_type: 'interval', interval_days: 4 },
      ),
    ).toBe(false)
  })

  it('changed mode or params are a change', () => {
    expect(
      scheduleChanged(
        form({ schedule_mode: 'weekdays', scheduled_days: MONDAY | FRIDAY }),
        { schedule_type: 'weekdays', scheduled_days: MONDAY },
      ),
    ).toBe(true)
    expect(
      scheduleChanged(form({ schedule_mode: 'weekly_target', weekly_target: '5' }), {
        schedule_type: 'daily',
      }),
    ).toBe(true)
  })

  it('custom mode changes are detected', () => {
    expect(
      scheduleChanged(
        form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' }),
        { schedule_type: 'custom', legacy_freq_times: 3, legacy_freq_days: 7 },
      ),
    ).toBe(false)
    expect(
      scheduleChanged(
        form({ schedule_mode: 'custom', freq_times: '4', freq_days: '7' }),
        { schedule_type: 'custom', legacy_freq_times: 3, legacy_freq_days: 7 },
      ),
    ).toBe(true)
    expect(
      scheduleChanged(
        form({ schedule_mode: 'custom', freq_times: '3', freq_days: '10' }),
        { schedule_type: 'custom', legacy_freq_times: 3, legacy_freq_days: 7 },
      ),
    ).toBe(true)
    expect(
      scheduleChanged(
        form({ schedule_mode: 'custom', freq_times: '2', freq_days: '7' }),
        { schedule_type: 'legacy', legacy_freq_times: 2, legacy_freq_days: 7 },
      ),
    ).toBe(true) // legacy -> custom is a change
  })

  it('a pending-probe draft (mode "") is conservatively unchanged', () => {
    expect(scheduleChanged(form({ schedule_mode: '' }), { schedule_type: 'daily' })).toBe(false)
  })
})

describe('loadedScheduleFromRow / formScheduleFromRow (row mapping)', () => {
  it('maps all schedule columns', () => {
    const row = {
      schedule_type: 'weekdays',
      scheduled_days: MONDAY | WEDNESDAY | FRIDAY,
      interval_days: null,
      weekly_target: null,
      legacy_freq_times: null,
      legacy_freq_days: null,
    }
    expect(loadedScheduleFromRow(row)).toEqual({
      schedule_type: 'weekdays',
      scheduled_days: MONDAY | WEDNESDAY | FRIDAY,
      interval_days: null,
      weekly_target: null,
      legacy_freq_times: null,
      legacy_freq_days: null,
    })
    expect(formScheduleFromRow(row)).toEqual({
      schedule_mode: 'weekdays',
      scheduled_days: MONDAY | WEDNESDAY | FRIDAY,
      interval_days: '2',
      weekly_target: '1',
      freq_times: '1',
      freq_days: '1',
    })
  })

  it('legacy rows keep their type and map to the legacy draft', () => {
    const row = { schedule_type: 'legacy', scheduled_days: null, interval_days: null, weekly_target: null }
    expect(loadedScheduleFromRow(row)?.schedule_type).toBe('legacy')
    expect(formScheduleFromRow(row).schedule_mode).toBe('legacy')
  })

  it('custom rows keep their type and map to the custom draft with freq', () => {
    const row = {
      schedule_type: 'custom',
      scheduled_days: null,
      interval_days: null,
      weekly_target: null,
      legacy_freq_times: 3,
      legacy_freq_days: 7,
    }
    expect(loadedScheduleFromRow(row)?.schedule_type).toBe('custom')
    expect(loadedScheduleFromRow(row)?.legacy_freq_times).toBe(3)
    expect(loadedScheduleFromRow(row)?.legacy_freq_days).toBe(7)
    expect(formScheduleFromRow(row).schedule_mode).toBe('custom')
    expect(formScheduleFromRow(row).freq_times).toBe('3')
    expect(formScheduleFromRow(row).freq_days).toBe('7')
  })

  it('missing columns (pre-migration row) map to a null snapshot and daily draft', () => {
    expect(loadedScheduleFromRow({})).toBeNull()
    expect(formScheduleFromRow({}).schedule_mode).toBe('daily')
  })

  it('invalid params fall back to the draft defaults', () => {
    const row = { schedule_type: 'weekdays', scheduled_days: 999, interval_days: 1, weekly_target: 99 }
    const mapped = formScheduleFromRow(row)
    expect(mapped.scheduled_days).toBe(31)
    expect(mapped.interval_days).toBe('2')
    expect(mapped.weekly_target).toBe('1')
  })
})

describe('creationScheduleFields (CREATE payload per mode)', () => {
  it('custom/legacy keeps the typed freq (normalize reclassifies it)', () => {
    expect(creationScheduleFields(form({ schedule_mode: 'legacy' }), 2, 7)).toEqual({
      freq_times: 2,
      freq_days: 7,
    })
    expect(creationScheduleFields(form({ schedule_mode: '' }), 3, 5)).toEqual({
      freq_times: 3,
      freq_days: 5,
    })
  })

  it('custom mode sends the custom freq plus schedule_type=custom', () => {
    const fields = creationScheduleFields(form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' }), 1, 1)
    expect(fields).toEqual({
      freq_times: 3,
      freq_days: 7,
      schedule_type: 'custom',
    })
  })

  it('daily sends freq 1/1 and NO schedule type (bit-identical to pre-Stage-3)', () => {
    const fields = creationScheduleFields(form({ schedule_mode: 'daily' }), 2, 7)
    expect(fields).toEqual({ freq_times: 1, freq_days: 1 })
    expect('schedule_type' in fields).toBe(false)
  })

  it('weekdays sends the mask plus its mirror', () => {
    expect(
      creationScheduleFields(form({ schedule_mode: 'weekdays', scheduled_days: MONDAY | WEDNESDAY | SUNDAY }), 9, 9),
    ).toEqual({
      freq_times: 3,
      freq_days: 7,
      schedule_type: 'weekdays',
      scheduled_days: MONDAY | WEDNESDAY | SUNDAY,
    })
  })

  it('interval and weekly_target send only their own column plus the mirror', () => {
    const interval = creationScheduleFields(form({ schedule_mode: 'interval', interval_days: '5' }), 1, 1)
    expect(interval).toEqual({
      freq_times: 1,
      freq_days: 5,
      schedule_type: 'interval',
      interval_days: 5,
    })
    expect('scheduled_days' in interval).toBe(false)

    const weekly = creationScheduleFields(form({ schedule_mode: 'weekly_target', weekly_target: '4' }), 1, 1)
    expect(weekly).toEqual({
      freq_times: 4,
      freq_days: 7,
      schedule_type: 'weekly_target',
      weekly_target: 4,
    })
    expect('interval_days' in weekly).toBe(false)
  })
})

describe('draftScheduleLabel (phone summary line)', () => {
  it('labels the four modes and the legacy freq', () => {
    expect(draftScheduleLabel(form({ schedule_mode: 'daily' }))).toBe('Every day')
    expect(draftScheduleLabel(form({ schedule_mode: 'weekdays', scheduled_days: WEDNESDAY }))).toBe('Wed')
    expect(draftScheduleLabel(form({ schedule_mode: 'interval', interval_days: '3' }))).toBe('Every 3 days')
    expect(draftScheduleLabel(form({ schedule_mode: 'weekly_target', weekly_target: '2' }))).toBe('2× per week')
    expect(draftScheduleLabel(form({ schedule_mode: 'legacy', freq_times: '2', freq_days: '7' }))).toBe(
      '2 times every 7 days',
    )
    expect(draftScheduleLabel(form({ schedule_mode: 'legacy', freq_times: '1', freq_days: '1' }))).toBe(
      'Every day',
    )
  })

  it('labels custom mode', () => {
    expect(draftScheduleLabel(form({ schedule_mode: 'custom', freq_times: '3', freq_days: '7' }))).toBe(
      '3 times every 7 days',
    )
    expect(draftScheduleLabel(form({ schedule_mode: 'custom', freq_times: '1', freq_days: '1' }))).toBe(
      'Every day',
    )
  })
})
