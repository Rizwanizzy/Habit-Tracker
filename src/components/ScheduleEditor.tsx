import { useRef } from 'react'
import { RangeSwitch } from './RangeSwitch'
import { WeekdayPicker } from './WeekdayPicker'
import { WheelPicker } from './WheelPicker'
import { rangeFor } from '../lib/wheel'
import { weekdayMaskCount, type ScheduleMode } from '../lib/schedule'
import {
  LEGACY_FIXED_EXPLANATION,
  modeAfterSelection,
  scheduleModeOptions,
  selectorModeFor,
} from '../lib/habitForm'
import type { FormState } from '../types/habit-form'

interface Props {
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  variant: 'desktop' | 'phone'
  /** True for the whole unsaved edit session when the habit was loaded with
   *  schedule_type='legacy'. Keeps the Custom pill mapped to the frozen
   *  `legacy` mode even after temporarily selecting another repeat mode. */
  legacyHabit?: boolean
}

/** Stage 3 repeat editor, rendered only when the schedule columns exist
 *  (capability probe passed). One component for both layouts — the mode
 *  switch is shared, the per-mode param controls differ per variant:
 *  desktop uses number inputs, phone uses the existing WheelPicker. */
export function ScheduleEditor({ form, setField, variant, legacyHabit = false }: Props) {
  // Wheel ranges must never shorten mid-drag: seeded with rangeFor and
  // widened whenever the current value exceeds the max (same pattern as
  // HabitFormMobile's freq wheels).
  const intervalNum = Math.max(2, Math.floor(Number(form.interval_days) || 2))
  const timesNum = Math.max(1, Math.floor(Number(form.freq_times) || 1))
  const daysNum = Math.max(1, Math.floor(Number(form.freq_days) || 1))
  const intervalMaxRef = useRef(rangeFor(intervalNum, 2, 31).max)
  if (intervalNum > intervalMaxRef.current) intervalMaxRef.current = intervalNum
  const timesMaxRef = useRef(rangeFor(timesNum, 1, 31).max)
  if (timesNum > timesMaxRef.current) timesMaxRef.current = timesNum
  const daysMaxRef = useRef(rangeFor(daysNum, 1, 31).max)
  if (daysNum > daysMaxRef.current) daysMaxRef.current = daysNum

  const mode = form.schedule_mode || 'daily'
  const desktop = variant === 'desktop'
  const modeOptions = scheduleModeOptions()

  const modeSwitch = (
    <RangeSwitch
      compact={desktop ? undefined : true}
      options={modeOptions}
      value={selectorModeFor(mode)}
      onChange={(k) =>
        setField('schedule_mode', modeAfterSelection(k as ScheduleMode, legacyHabit))
      }
      ariaLabel="Repeat mode"
    />
  )

  // --- Per-mode parameter controls -------------------------------------------
  let params: React.ReactNode = null
  switch (mode) {
    case 'daily':
      params = (
        <p className={desktop ? 'text-caption mt-2 text-fg-muted' : 'text-caption text-fg-muted'}>
          This habit repeats every day.
        </p>
      )
      break
    case 'weekdays':
      params = (
        <div className={desktop ? 'mt-3' : ''}>
          <WeekdayPicker
            value={form.scheduled_days}
            onChange={(mask) => setField('scheduled_days', mask)}
          />
          <p className={desktop ? 'text-caption mt-2 text-fg-muted' : 'text-caption mt-2 text-fg-muted'}>
            {weekdayMaskCount(form.scheduled_days)} day
            {weekdayMaskCount(form.scheduled_days) === 1 ? '' : 's'} each week
          </p>
        </div>
      )
      break
    case 'interval':
      params = desktop ? (
        <div className="mt-3">
          <label htmlFor="habit-interval" className="text-caption block text-fg-muted">
            Days between repeats
          </label>
          <input
            id="habit-interval"
            type="number"
            min="2"
            value={form.interval_days}
            onChange={(e) => setField('interval_days', e.target.value)}
            className="input-field mt-2"
          />
          <p className="text-caption mt-2 text-fg-muted">
            Repeats every N days, counted from the day the schedule starts.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center pt-1">
          <WheelPicker
            label="Every N days"
            value={intervalNum}
            min={2}
            max={intervalMaxRef.current}
            onChange={(v) => setField('interval_days', String(v))}
            className="rounded-input"
          />
          <span className="text-caption mt-1 text-fg-muted">days between repeats</span>
        </div>
      )
      break
    case 'weekly_target':
      params = desktop ? (
        <div className="mt-3">
          <label htmlFor="habit-weekly" className="text-caption block text-fg-muted">
            Times per week
          </label>
          <input
            id="habit-weekly"
            type="number"
            min="1"
            max="7"
            value={form.weekly_target}
            onChange={(e) => setField('weekly_target', e.target.value)}
            className="input-field mt-2"
          />
          <p className="text-caption mt-2 text-fg-muted">
            Weeks run Monday–Sunday; the score counts weeks, not days.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center pt-1">
          <WheelPicker
            label="Times per week"
            value={Math.min(7, Math.max(1, Math.floor(Number(form.weekly_target) || 1)))}
            min={1}
            max={7}
            onChange={(v) => setField('weekly_target', String(v))}
            className="rounded-input"
          />
          <span className="text-caption mt-1 text-fg-muted">times per week (Mon–Sun)</span>
        </div>
      )
      break
    default: {
      // custom is editable; `legacy` is the frozen pre-scheduling snapshot.
      const isLegacy = mode === 'legacy'
      if (desktop) {
        params = (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="habit-times" className="text-caption block text-fg-muted">
                  Times
                </label>
                <input
                  id="habit-times"
                  type="number"
                  min="1"
                  max="31"
                  disabled={isLegacy}
                  readOnly={isLegacy}
                  value={form.freq_times}
                  onChange={(e) => setField('freq_times', e.target.value)}
                  className="input-field mt-2 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="habit-days" className="text-caption block text-fg-muted">
                  Per days
                </label>
                <input
                  id="habit-days"
                  type="number"
                  min="1"
                  max="31"
                  disabled={isLegacy}
                  readOnly={isLegacy}
                  value={form.freq_days}
                  onChange={(e) => setField('freq_days', e.target.value)}
                  className="input-field mt-2 disabled:opacity-60"
                />
              </div>
            </div>
            <p className="text-caption mt-2 text-fg-muted">
              {isLegacy
                ? LEGACY_FIXED_EXPLANATION
                : 'e.g., 3 times every 7 days = ~3× per week'}
            </p>
          </div>
        )
      } else if (isLegacy) {
        // Phone legacy: the same two-wheel row as editable Custom, but each
        // wheel shows only its selected value and cannot scroll, drag, take
        // keyboard input, or change.
        params = (
          <div>
            <div className="flex items-start justify-center gap-4 pt-1">
              <div className="flex flex-col items-center">
                <WheelPicker
                  label="Times"
                  value={timesNum}
                  min={1}
                  max={timesMaxRef.current}
                  onChange={() => undefined}
                  readOnly
                  className="rounded-input"
                />
                <span className="text-caption mt-1 text-fg-muted">times</span>
              </div>
              <span className="text-body pt-10 text-fg-secondary">every</span>
              <div className="flex flex-col items-center">
                <WheelPicker
                  label="Days"
                  value={daysNum}
                  min={1}
                  max={daysMaxRef.current}
                  onChange={() => undefined}
                  readOnly
                  className="rounded-input"
                />
                <span className="text-caption mt-1 text-fg-muted">days</span>
              </div>
            </div>
            <p className="text-caption mt-2 text-center text-fg-muted">
              {LEGACY_FIXED_EXPLANATION}
            </p>
          </div>
        )
      } else {
        // Mobile custom mode: editable WheelPickers
        params = (
          <div className="flex items-start justify-center gap-4 pt-1">
            <div className="flex flex-col items-center">
              <WheelPicker
                label="Times"
                value={timesNum}
                min={1}
                max={Math.min(timesMaxRef.current, 31)}
                onChange={(v) => setField('freq_times', String(v))}
                className="rounded-input"
              />
              <span className="text-caption mt-1 text-fg-muted">times</span>
            </div>
            <span className="text-body pt-10 text-fg-secondary">every</span>
            <div className="flex flex-col items-center">
              <WheelPicker
                label="Days"
                value={daysNum}
                min={1}
                max={Math.min(daysMaxRef.current, 31)}
                onChange={(v) => setField('freq_days', String(v))}
                className="rounded-input"
              />
              <span className="text-caption mt-1 text-fg-muted">days</span>
            </div>
          </div>
        )
      }
    }
  }

  if (desktop) {
    return (
      <div>
        <span className="text-caption block text-fg-muted">Repeat</span>
        <div className="mt-2">{modeSwitch}</div>
        {params}
      </div>
    )
  }
  return (
    <div className="pt-1">
      {modeSwitch}
      <div className="mt-3">{params}</div>
    </div>
  )
}
