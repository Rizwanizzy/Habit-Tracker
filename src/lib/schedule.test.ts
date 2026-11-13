import { describe, it, expect } from 'vitest'
import {
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  SUNDAY,
  weekdayBit,
  isValidWeekdayMask,
  isValidInterval,
  isValidWeeklyTarget,
  validateSchedule,
  resolveEpoch,
  sortEpochs,
  isScheduledOn,
  weekStart,
  weekEnd,
  weeklyTargetContext,
  isTransitionEpoch,
  transitionWeekStart,
  isTransitionWeek,
  type ScheduleEpoch,
} from './schedule'

// Reference week (Nov 2026): 09 Mon, 10 Tue, 11 Wed, 12 Thu, 13 Fri,
// 14 Sat, 15 Sun — next Monday 16.
const MON = '2026-11-09'
const TUE = '2026-11-10'
const WED = '2026-11-11'
const THU = '2026-11-12'
const FRI = '2026-11-13'
const SAT = '2026-11-14'
const SUN = '2026-11-15'
const NEXT_MON = '2026-11-16'

function epoch(over: Partial<ScheduleEpoch>): ScheduleEpoch {
  return {
    id: 'e1',
    effective_from: MON,
    schedule_type: 'daily',
    scheduled_days: null,
    interval_days: null,
    weekly_target: null,
    ...over,
  }
}

describe('weekdayBit (Mon=1 … Sun=64)', () => {
  it('maps each day of the reference week to its bit', () => {
    expect(weekdayBit(MON)).toBe(MONDAY)
    expect(weekdayBit(TUE)).toBe(TUESDAY)
    expect(weekdayBit(WED)).toBe(WEDNESDAY)
    expect(weekdayBit(THU)).toBe(THURSDAY)
    expect(weekdayBit(FRI)).toBe(FRIDAY)
    expect(weekdayBit(SAT)).toBe(SATURDAY)
    expect(weekdayBit(SUN)).toBe(SUNDAY)
  })

  it('returns 0 for invalid date strings (never matches a valid mask)', () => {
    expect(weekdayBit('2026-2-9')).toBe(0)
    expect(weekdayBit('not-a-date')).toBe(0)
    expect(weekdayBit('2026-02-30')).toBe(0)
  })
})

describe('weekdays eligibility', () => {
  it('a single-bit mask makes exactly its weekday eligible', () => {
    const cases: Array<[number, string]> = [
      [MONDAY, MON],
      [TUESDAY, TUE],
      [WEDNESDAY, WED],
      [THURSDAY, THU],
      [FRIDAY, FRI],
      [SATURDAY, SAT],
      [SUNDAY, SUN],
    ]
    for (const [bit, date] of cases) {
      const e = epoch({ schedule_type: 'weekdays', scheduled_days: bit })
      for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) {
        expect(isScheduledOn(d, e)).toBe(d === date)
      }
    }
  })

  it('combined masks select every matching weekday', () => {
    const mask = MONDAY | WEDNESDAY | SATURDAY // 37
    const e = epoch({ schedule_type: 'weekdays', scheduled_days: mask })
    expect(isScheduledOn(MON, e)).toBe(true)
    expect(isScheduledOn(TUE, e)).toBe(false)
    expect(isScheduledOn(WED, e)).toBe(true)
    expect(isScheduledOn(THU, e)).toBe(false)
    expect(isScheduledOn(FRI, e)).toBe(false)
    expect(isScheduledOn(SAT, e)).toBe(true)
    expect(isScheduledOn(SUN, e)).toBe(false)
  })

  it('the all-bits mask (127) is eligible every day', () => {
    const e = epoch({ schedule_type: 'weekdays', scheduled_days: 127 })
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) expect(isScheduledOn(d, e)).toBe(true)
  })

  it('invalid masks are never eligible', () => {
    expect(isValidWeekdayMask(0)).toBe(false)
    expect(isValidWeekdayMask(128)).toBe(false)
    expect(isValidWeekdayMask(-3)).toBe(false)
    expect(isValidWeekdayMask(1.5)).toBe(false)
    expect(isValidWeekdayMask(Number.NaN)).toBe(false)
    expect(isValidWeekdayMask('3')).toBe(false)
    expect(isValidWeekdayMask(null)).toBe(false)
    expect(isValidWeekdayMask(1)).toBe(true)
    expect(isValidWeekdayMask(127)).toBe(true)
    expect(isScheduledOn(MON, epoch({ schedule_type: 'weekdays', scheduled_days: 0 }))).toBe(false)
    expect(isScheduledOn(MON, epoch({ schedule_type: 'weekdays', scheduled_days: 128 }))).toBe(false)
  })
})

describe('interval eligibility (anchored to the epoch, not the clock)', () => {
  it('every 3rd day from the anchor onward, never before it', () => {
    const e = epoch({ schedule_type: 'interval', interval_days: 3 })
    expect(isScheduledOn('2026-11-08', e)).toBe(false) // before the anchor
    expect(isScheduledOn('2026-11-06', e)).toBe(false)
    expect(isScheduledOn(MON, e)).toBe(true) // anchor day itself
    expect(isScheduledOn(TUE, e)).toBe(false)
    expect(isScheduledOn(WED, e)).toBe(false)
    expect(isScheduledOn(THU, e)).toBe(true) // anchor + 3
    expect(isScheduledOn(SUN, e)).toBe(true) // anchor + 6
    expect(isScheduledOn('2026-11-13', e)).toBe(false) // anchor + 4
  })

  it('every 2nd day alternates', () => {
    const e = epoch({ schedule_type: 'interval', interval_days: 2 })
    expect(isScheduledOn(MON, e)).toBe(true)
    expect(isScheduledOn(TUE, e)).toBe(false)
    expect(isScheduledOn(WED, e)).toBe(true)
    expect(isScheduledOn(THU, e)).toBe(false)
    expect(isScheduledOn(FRI, e)).toBe(true)
  })

  it('invalid intervals (non-integer or < 2) are never eligible', () => {
    expect(isValidInterval(1)).toBe(false)
    expect(isValidInterval(0)).toBe(false)
    expect(isValidInterval(2.5)).toBe(false)
    expect(isValidInterval(null)).toBe(false)
    expect(isValidInterval(2)).toBe(true)
    expect(isScheduledOn(MON, epoch({ schedule_type: 'interval', interval_days: 1 }))).toBe(false)
  })
})

describe('Monday–Sunday week helpers', () => {
  it('weekStart/weekEnd bracket the Mon–Sun week', () => {
    expect(weekStart(FRI)).toBe(MON)
    expect(weekEnd(FRI)).toBe(SUN)
    expect(weekStart(SUN)).toBe(MON) // Sunday closes the same week
    expect(weekEnd(MON)).toBe(SUN)
    expect(weekStart(MON)).toBe(MON) // Monday is its own start
  })

  it('a new week starts on Monday, not Sunday', () => {
    expect(weekStart(SUN)).toBe(MON)
    expect(weekStart(NEXT_MON)).toBe(NEXT_MON)
    expect(weekStart(NEXT_MON)).not.toBe(weekStart(SUN))
  })

  it('weeklyTargetContext returns boundaries plus the target', () => {
    expect(weeklyTargetContext(FRI, 3)).toEqual({ weekStart: MON, weekEnd: SUN, target: 3 })
    expect(weeklyTargetContext(NEXT_MON, 1)).toEqual({
      weekStart: NEXT_MON,
      weekEnd: '2026-11-22',
      target: 1,
    })
    expect(weeklyTargetContext(FRI, 0)).toBeNull()
    expect(weeklyTargetContext(FRI, 8)).toBeNull()
    expect(weeklyTargetContext(FRI, 2.5)).toBeNull()
  })
})

describe('weekly target validation', () => {
  it('accepts integer targets 1–7 only', () => {
    for (let t = 1; t <= 7; t++) expect(isValidWeeklyTarget(t)).toBe(true)
    expect(isValidWeeklyTarget(0)).toBe(false)
    expect(isValidWeeklyTarget(8)).toBe(false)
    expect(isValidWeeklyTarget(3.5)).toBe(false)
    expect(isValidWeeklyTarget('3')).toBe(false)
    expect(isValidWeeklyTarget(null)).toBe(false)
  })
})

describe('validateSchedule (error-list convention)', () => {
  it('accepts a clean payload of every mode', () => {
    expect(validateSchedule({ schedule_type: 'daily' })).toEqual([])
    expect(validateSchedule({ schedule_type: 'weekdays', scheduled_days: 127 })).toEqual([])
    expect(validateSchedule({ schedule_type: 'interval', interval_days: 3 })).toEqual([])
    expect(validateSchedule({ schedule_type: 'weekly_target', weekly_target: 4 })).toEqual([])
  })

  it('rejects invalid payloads with a message each', () => {
    expect(validateSchedule({ schedule_type: 'weekdays', scheduled_days: 0 }).length).toBe(1)
    expect(validateSchedule({ schedule_type: 'weekdays', scheduled_days: 128 }).length).toBe(1)
    expect(validateSchedule({ schedule_type: 'interval', interval_days: 1 }).length).toBe(1)
    expect(validateSchedule({ schedule_type: 'weekly_target', weekly_target: 0 }).length).toBe(1)
    expect(validateSchedule({ schedule_type: 'weekly_target', weekly_target: 9 }).length).toBe(1)
    expect(validateSchedule({ schedule_type: 'nope' as never }).length).toBe(1)
  })

  it('rejects stray fields that do not belong to the mode', () => {
    expect(
      validateSchedule({ schedule_type: 'daily', interval_days: 3 } as never).length).toBe(1)
    expect(
      validateSchedule({ schedule_type: 'weekdays', scheduled_days: 5, weekly_target: 2 }).length,
    ).toBe(1)
    expect(
      validateSchedule({ schedule_type: 'interval', interval_days: 3, scheduled_days: 5 }).length,
    ).toBe(1)
    expect(
      validateSchedule({ schedule_type: 'weekly_target', weekly_target: 2, interval_days: 3 }).length,
    ).toBe(1)
  })
})

describe('epoch resolution', () => {
  const epochs: ScheduleEpoch[] = [
    epoch({ id: 'e1', effective_from: '2026-11-01', schedule_type: 'daily' }),
    epoch({ id: 'e2', effective_from: TUE, schedule_type: 'weekdays', scheduled_days: TUESDAY }),
  ]

  it('picks the latest epoch effective on or before the date', () => {
    expect(resolveEpoch(epochs, '2026-10-31')).toBeUndefined() // before the first
    expect(resolveEpoch(epochs, '2026-11-01')?.id).toBe('e1')
    expect(resolveEpoch(epochs, MON)?.id).toBe('e1')
    expect(resolveEpoch(epochs, TUE)?.id).toBe('e2') // effective the same day
    expect(resolveEpoch(epochs, SUN)?.id).toBe('e2')
    expect(resolveEpoch(epochs, '2026-12-01')?.id).toBe('e2')
  })

  it('same-day epochs resolve to the final one (append order wins)', () => {
    const sameDay: ScheduleEpoch[] = [
      epoch({ id: 'a', effective_from: TUE, schedule_type: 'weekdays', scheduled_days: MONDAY }),
      epoch({ id: 'b', effective_from: TUE, schedule_type: 'interval', interval_days: 3 }),
    ]
    expect(resolveEpoch(sameDay, FRI)?.id).toBe('b')
    // The winning epoch decides eligibility: FRI is anchor+3 (interval
    // eligible) while a Monday-mask day would reject it.
    expect(isScheduledOn(FRI, resolveEpoch(sameDay, FRI)!)).toBe(true)
    expect(isScheduledOn(FRI, sameDay[0])).toBe(false)
  })

  it('never mutates the caller array and sorts ascending', () => {
    const input: ScheduleEpoch[] = [
      epoch({ id: 'b', effective_from: TUE }),
      epoch({ id: 'a', effective_from: '2026-11-01' }),
    ]
    const snapshot = input.map((e) => e.id)
    const sorted = sortEpochs(input)
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b'])
    expect(input.map((e) => e.id)).toEqual(snapshot)
    expect(sorted).not.toBe(input)
  })

  it('a date before the first epoch is never eligible', () => {
    const e = resolveEpoch(epochs, '2026-10-31')
    expect(e).toBeUndefined()
    expect(isScheduledOn('2026-10-31', epoch({}))).toBe(false) // before effective_from
  })
})

describe('legacy epochs keep pre-scheduling semantics', () => {
  it('a legacy epoch is eligible every day from its effective date', () => {
    const e = epoch({
      schedule_type: 'legacy',
      legacy_freq_times: 2,
      legacy_freq_days: 7,
    })
    expect(isScheduledOn(MON, e)).toBe(true)
    expect(isScheduledOn(SUN, e)).toBe(true)
    expect(isScheduledOn('2026-11-08', e)).toBe(false) // still bounded by the anchor
  })
})

describe('weekly-target transition weeks (Mon–Sun rule)', () => {
  it('Tuesday–Sunday effective dates make the start week a transition', () => {
    const tue = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: TUE })
    expect(isTransitionEpoch(tue)).toBe(true)
    expect(transitionWeekStart(tue)).toBe(MON)
    const sun = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: SUN })
    expect(isTransitionEpoch(sun)).toBe(true)
    expect(transitionWeekStart(sun)).toBe(MON)
  })

  it('a Monday effective date is not a transition week', () => {
    const mon = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: MON })
    expect(isTransitionEpoch(mon)).toBe(false)
    expect(transitionWeekStart(mon)).toBeNull()
  })

  it('other modes never produce transition weeks', () => {
    expect(isTransitionEpoch(epoch({ schedule_type: 'daily', effective_from: TUE }))).toBe(false)
    expect(
      isTransitionEpoch(epoch({ schedule_type: 'interval', interval_days: 3, effective_from: TUE })),
    ).toBe(false)
  })

  it('isTransitionWeek only fires inside the start week of the epoch', () => {
    const tue = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: TUE })
    const epochs = [tue]
    expect(isTransitionWeek(epochs, FRI)).toBe(true) // same Mon–Sun week
    expect(isTransitionWeek(epochs, TUE)).toBe(true)
    expect(isTransitionWeek(epochs, NEXT_MON)).toBe(false) // next week is active
    expect(isTransitionWeek(epochs, '2026-11-02')).toBe(false) // epoch not yet effective
  })

  it('a Sunday-effective epoch transitions the week it lands in', () => {
    const sun = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: SUN })
    expect(isTransitionWeek([sun], FRI)).toBe(true) // SUN is inside Mon 09–Sun 15
    expect(isTransitionWeek([sun], NEXT_MON)).toBe(false)
  })
})

describe('weekly-target day eligibility across the transition', () => {
  it('days in the transition week are not scheduled; later weeks are', () => {
    const tue = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: TUE })
    for (const d of [TUE, WED, THU, FRI, SAT, SUN]) expect(isScheduledOn(d, tue)).toBe(false)
    expect(isScheduledOn(NEXT_MON, tue)).toBe(true)
    expect(isScheduledOn('2026-11-18', tue)).toBe(true)
  })

  it('a Monday-effective weekly target is active immediately, all week', () => {
    const mon = epoch({ schedule_type: 'weekly_target', weekly_target: 3, effective_from: MON })
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) expect(isScheduledOn(d, mon)).toBe(true)
    expect(isScheduledOn(NEXT_MON, mon)).toBe(true)
  })
})
