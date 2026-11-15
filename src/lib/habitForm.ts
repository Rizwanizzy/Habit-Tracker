/** Stage 3 — pure HabitForm × schedule glue. Maps the FormState draft into
 *  DB payloads and back, and detects schedule edits (which must go through
 *  the append_habit_schedule_epoch RPC after the v7 migration). No React,
 *  no Supabase — everything here is unit-testable. */
import {
  freqMirrorFor,
  isValidInterval,
  isValidWeeklyTarget,
  isValidWeekdayMask,
  scheduleLabel,
  type ScheduleConfig,
  type ScheduleMode,
  type ScheduleType,
} from './schedule'
import type { FormState } from '../types/habit-form'

/** One repeat-mode pill for the HabitForm ScheduleEditor. */
export interface ScheduleModeOption {
  key: ScheduleMode
  label: string
  short: string
}

/** Create/edit repeat modes. `custom` is the editable "X times every Y days"
 *  mode; it must NOT reuse the `legacy` key, or a new habit's Custom selection
 *  would be mistaken for a frozen pre-scheduling schedule. */
const BASE_SCHEDULE_MODE_OPTIONS: ScheduleModeOption[] = [
  { key: 'daily', label: 'Every day', short: 'Daily' },
  { key: 'weekdays', label: 'Specific days', short: 'Days' },
  { key: 'interval', label: 'Every N days', short: 'N days' },
  { key: 'weekly_target', label: 'Weekly goal', short: 'Weekly' },
  { key: 'custom', label: 'Custom', short: 'Custom' },
]

/** Repeat pills shown by ScheduleEditor. Always exactly these five options: a
 *  legacy snapshot displays Custom as selected without gaining a sixth pill. */
export function scheduleModeOptions(): ScheduleModeOption[] {
  return BASE_SCHEDULE_MODE_OPTIONS
}

/** Which pill to highlight. Legacy snapshots show Custom, but the underlying
 *  `form.schedule_mode` stays 'legacy' (frozen freq, no custom conversion). */
export function selectorModeFor(mode: ScheduleMode | ''): ScheduleMode {
  if (!mode) return 'daily'
  return mode === 'legacy' ? 'custom' : mode
}

/** Resolve a Repeat pill click. While the habit's loaded identity is legacy
 *  (for the whole unsaved session), choosing Custom returns to the frozen
 *  `legacy` mode instead of the editable `custom` mode. After a modern
 *  schedule is successfully saved, the page clears that origin flag, so the
 *  same click then selects editable `custom`. */
export function modeAfterSelection(
  selected: ScheduleMode,
  originallyLegacy: boolean,
): ScheduleMode {
  if (originallyLegacy && selected === 'custom') return 'legacy'
  return selected
}

/** Shown under the frozen legacy schedule. Kept here so the copy is shared by
 *  the desktop and phone layouts and can be unit-tested. */
export const LEGACY_FIXED_EXPLANATION =
  'This is an older fixed schedule. Choose another repeat option above to change it.'

/** Minimal shape of the schedule columns on a habit row (absent entirely on
 *  a pre-migration database). */
export interface ScheduleRowLike {
  schedule_type?: string | null
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  /** Current frequency mirror (always present on habit row). */
  freq_times?: number
  freq_days?: number
  /** Custom/legacy frequency from history epoch (optional, for form loading). */
  legacy_freq_times?: number | null
  legacy_freq_days?: number | null
}

/** A schedule snapshot for change detection (the loaded habit row's columns;
 *  `legacy` is a real value here, unlike in ScheduleConfig). */
export type ScheduleSnapshot = {
  schedule_type: ScheduleMode
  scheduled_days?: number | null
  interval_days?: number | null
  weekly_target?: number | null
  legacy_freq_times?: number | null
  legacy_freq_days?: number | null
}

/** HabitInput schedule + frequency fields for CREATE (schedule-capable). */
export interface HabitScheduleFields {
  freq_times: number
  freq_days: number
  schedule_type?: ScheduleType
  scheduled_days?: number
  interval_days?: number
  weekly_target?: number
}

/** The schedule the FormState draft currently describes. `legacy`/'' drafts
 *  return null — a legacy habit's freq is frozen user data, not a config. */
export function draftSchedule(form: FormState): ScheduleConfig | null {
  switch (form.schedule_mode) {
    case 'daily':
      return { schedule_type: 'daily' }
    case 'weekdays':
      return { schedule_type: 'weekdays', scheduled_days: form.scheduled_days }
    case 'interval':
      return {
        schedule_type: 'interval',
        interval_days: Math.max(2, Math.floor(Number(form.interval_days) || 2)),
      }
    case 'weekly_target':
      return {
        schedule_type: 'weekly_target',
        weekly_target: Math.min(7, Math.max(1, Math.floor(Number(form.weekly_target) || 1))),
      }
    case 'custom':
      // Keep the raw numeric draft (no flooring) so validateSchedule can
      // reject non-integers instead of silently coercing them.
      return {
        schedule_type: 'custom',
        legacy_freq_times: Number(form.freq_times),
        legacy_freq_days: Number(form.freq_days),
      }
    default:
      return null
  }
}

/** Same schedule? Params compared per mode — each mode equals only itself. */
export function sameSchedule(
  a: ScheduleSnapshot | null,
  b: ScheduleSnapshot | null,
): boolean {
  if (a === null || b === null) return a === null && b === null
  if (a.schedule_type !== b.schedule_type) return false
  switch (a.schedule_type) {
    case 'weekdays':
      return (a.scheduled_days ?? 0) === (b.scheduled_days ?? 0)
    case 'interval':
      return (a.interval_days ?? 0) === (b.interval_days ?? 0)
    case 'weekly_target':
      return (a.weekly_target ?? 0) === (b.weekly_target ?? 0)
    case 'custom':
      return (a.legacy_freq_times ?? 0) === (b.legacy_freq_times ?? 0) &&
             (a.legacy_freq_days ?? 0) === (b.legacy_freq_days ?? 0)
    default:
      return true // daily — no params
  }
}

/** True when the form's schedule differs from the loaded snapshot (an edit
 *  must go through the RPC). A null loaded snapshot (pre-migration row or an
 *  unknown type) can't be compared against, so it counts as unchanged — the
 *  page only calls this when scheduling is capable anyway. Staying on
 *  'legacy' is NOT a change: legacy habits are displayed, never converted.
 *  For 'custom' mode, compare the legacy_freq_times and legacy_freq_days. */
export function scheduleChanged(
  form: FormState,
  loaded: ScheduleSnapshot | null,
): boolean {
  if (loaded === null || form.schedule_mode === '') return false
  if (form.schedule_mode === 'legacy') return loaded.schedule_type !== 'legacy'
  if (form.schedule_mode === 'custom') {
    const times = Math.max(1, Math.floor(Number(form.freq_times) || 1))
    const days = Math.max(1, Math.floor(Number(form.freq_days) || 1))
    return loaded.schedule_type !== 'custom' ||
           (loaded.legacy_freq_times ?? 0) !== times ||
           (loaded.legacy_freq_days ?? 0) !== days
  }
  const draft = draftSchedule(form)
  return draft !== null && !sameSchedule(draft, loaded)
}

/** The loaded habit row's schedule snapshot for change detection, or null
 *  when the row has no schedule columns (pre-migration) or an unknown type. */
export function loadedScheduleFromRow(row: ScheduleRowLike & { legacy_freq_times?: number | null; legacy_freq_days?: number | null }): ScheduleSnapshot | null {
  const type = row.schedule_type
  if (type === 'daily' || type === 'weekdays' || type === 'interval' || type === 'weekly_target' || type === 'legacy' || type === 'custom') {
    return {
      schedule_type: type,
      scheduled_days: row.scheduled_days ?? null,
      interval_days: row.interval_days ?? null,
      weekly_target: row.weekly_target ?? null,
      legacy_freq_times: row.legacy_freq_times ?? null,
      legacy_freq_days: row.legacy_freq_days ?? null,
    }
  }
  return null
}

/** A habit row's schedule columns → the FormState schedule fields (mode plus
 *  per-mode draft values; missing params fall back to the FORM_BLANK-like
 *  defaults so the editors always render a sane draft). */
export function formScheduleFromRow(
  row: ScheduleRowLike & { legacy_freq_times?: number | null; legacy_freq_days?: number | null },
): Pick<FormState, 'schedule_mode' | 'scheduled_days' | 'interval_days' | 'weekly_target' | 'freq_times' | 'freq_days'> {
  const type = row.schedule_type
  if (
    type === 'daily' ||
    type === 'weekdays' ||
    type === 'interval' ||
    type === 'weekly_target' ||
    type === 'legacy' ||
    type === 'custom'
  ) {
    return {
      schedule_mode: type,
      scheduled_days: isValidWeekdayMask(row.scheduled_days ?? 0) ? (row.scheduled_days as number) : 31,
      interval_days: String(isValidInterval(row.interval_days ?? 0) ? row.interval_days : 2),
      weekly_target: String(isValidWeeklyTarget(row.weekly_target ?? 0) ? row.weekly_target : 1),
      freq_times: String(row.legacy_freq_times ?? row.freq_times ?? 1),
      freq_days: String(row.legacy_freq_days ?? row.freq_days ?? 1),
    }
  }
  return { schedule_mode: 'daily', scheduled_days: 31, interval_days: '2', weekly_target: '1', freq_times: '1', freq_days: '1' }
}

/** Creation payload fields for the chosen mode. Custom/legacy keeps the
 *  typed freq (the DB normalize trigger reclassifies non-daily freq to
 *  legacy); daily sends freq 1/1 and NO schedule_type, so it is bit-identical
 *  to pre-Stage-3 daily creation; the other modes send their own column plus
 *  the freq mirror the v7 habits_freq_mirror_ck constraint requires. */
export function creationScheduleFields(
  form: FormState,
  freqTimes: number,
  freqDays: number,
): HabitScheduleFields {
  const config = draftSchedule(form)
  if (config === null) return { freq_times: freqTimes, freq_days: freqDays }
  if (config.schedule_type === 'daily') return { freq_times: 1, freq_days: 1 }
  const mirror = freqMirrorFor(config.schedule_type, config)
  const fields: HabitScheduleFields = {
    freq_times: mirror.freq_times,
    freq_days: mirror.freq_days,
    schedule_type: config.schedule_type,
  }
  if (config.scheduled_days != null) fields.scheduled_days = config.scheduled_days
  if (config.interval_days != null) fields.interval_days = config.interval_days
  if (config.weekly_target != null) fields.weekly_target = config.weekly_target
  if (config.legacy_freq_times != null) fields.freq_times = config.legacy_freq_times
  if (config.legacy_freq_days != null) fields.freq_days = config.legacy_freq_days
  return fields
}

/** Human label of the form's current repeat draft (phone summary line). */
export function draftScheduleLabel(form: FormState): string {
  const config = draftSchedule(form)
  if (config === null) {
    const times = Math.max(1, Math.floor(Number(form.freq_times) || 1))
    const days = Math.max(1, Math.floor(Number(form.freq_days) || 1))
    return scheduleLabel({ schedule_type: 'legacy', freq_times: times, freq_days: days })
  }
  return scheduleLabel(config)
}
