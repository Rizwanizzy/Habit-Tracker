import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ColorPickerCircle } from './ColorPickerCircle'
import { EmojiPickerField } from './EmojiPickerField'
import { HabitPreview } from './HabitPreview'
import { RangeSwitch } from './RangeSwitch'
import { WheelPicker } from './WheelPicker'
import { rangeFor } from '../lib/wheel'
import type { FormEvent } from 'react'
import type { FormState } from '../types/habit-form'
import { IconChevronLeft } from './icons'

/** Back = the previous app screen when there is one (React Router keeps an
 *  `idx` in history.state), else straight to "/" — covers cold PWA opens. */
function useBack(): () => void {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/')
  }
}

interface Props {
  editing: boolean
  busy: boolean
  form: FormState
  formError: string | null
  setColor: (hex: string) => void
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

/** "Every day" for 1×/1d; "N times every M days" otherwise. */
function repeatSummary(times: number, days: number): string {
  if (times === 1 && days === 1) return 'Every day'
  return `${times} times every ${days} days`
}

/** Phone form for /habits/new and /habits/:id/edit (below lg). Shares ALL
 *  state/validation/submit logic with the untouched desktop form through
 *  props — the two layouts are separate <form> elements and only one is
 *  visible at a time (the page wraps them in lg:hidden / hidden lg:block). */
export function HabitFormMobile({
  editing,
  busy,
  form,
  formError,
  setColor,
  setField,
  onSubmit,
}: Props) {
  const goBack = useBack()

  const timesNum = Math.max(1, Math.floor(Number(form.freq_times) || 1))
  const daysNum = Math.max(1, Math.floor(Number(form.freq_days) || 1))
  const targetNum = Math.max(1, Math.floor(Number(form.target) || 1))
  // The wheel's row list must never shorten mid-drag (rows above the centre
  // would shift under the finger), so each wheel's max only grows: seeded
  // with rangeFor (default 1–31, raised so a larger saved value is listed)
  // and widened any time the value itself exceeds it.
  const timesMaxRef = useRef(rangeFor(timesNum, 1, 31).max)
  if (timesNum > timesMaxRef.current) timesMaxRef.current = timesNum
  const daysMaxRef = useRef(rangeFor(daysNum, 1, 31).max)
  if (daysNum > daysMaxRef.current) daysMaxRef.current = daysNum
  const targetMaxRef = useRef(rangeFor(targetNum, 1, 31).max)
  if (targetNum > targetMaxRef.current) targetMaxRef.current = targetNum

  return (
    <form onSubmit={onSubmit} id="habit-form-mobile" className="pb-2">
      {/* 1 · TOP BAR: 44px glass back circle + 22px display title, no subtitle. */}
      <div className="fade-up flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="glass-pill grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <IconChevronLeft className="size-5" />
        </button>
        <h1 className="font-display text-[22px] font-bold leading-7">
          {editing ? 'Edit habit' : 'Add habit'}
        </h1>
      </div>

      {/* 2 · NAME ROW: 52px input + 52px emoji circle, 8px apart. No autofocus. */}
      <div className="fade-up mt-3 flex items-center gap-2" style={{ animationDelay: '20ms' }}>
        <label htmlFor="habit-name-mobile" className="sr-only">
          Name
        </label>
        <input
          id="habit-name-mobile"
          type="text"
          required
          autoComplete="off"
          enterKeyHint="done"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Meditate"
          className="input-field input-field-lg h-[52px] min-w-0 flex-1"
        />
        <EmojiPickerField
          variant="circle"
          value={form.emoji}
          color={form.color}
          onChange={(emoji) => setField('emoji', emoji)}
        />
      </div>
      <p className="sr-only">Optional emoji, shown in the habit's check circle on Today.</p>

      {/* 3 · SETTINGS CARD: hairline-separated 56px rows. */}
      <div
        className="glass-card fade-up mt-3 rounded-card px-4"
        style={{ animationDelay: '40ms' }}
      >
        {/* a · TYPE: compact segmented switch. */}
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <span className="text-[15px] text-fg">Type</span>
          <RangeSwitch
            compact
            options={[
              { key: 'boolean', label: 'Yes / no' },
              { key: 'numeric', label: 'Numeric' },
            ]}
            value={form.type}
            onChange={(k) => setField('type', k as FormState['type'])}
            ariaLabel="Habit type"
          />
        </div>

        {/* b · COLOR: one habit-colored circle; popover = existing ColorPicker. */}
        <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border py-2">
          <span className="text-[15px] text-fg">Color</span>
          <ColorPickerCircle color={form.color} onChange={setColor} />
        </div>

        {/* c · GOAL (numeric only): daily-target wheel + unit input on one
            row; the row collapses/fades in ~200ms; inert keeps the hidden
            inputs out of tab order and taps. */}
        <div
          inert={form.type === 'numeric' ? undefined : true}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            form.type === 'numeric'
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0'
          } motion-reduce:transition-none`}
        >
          <div className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-t border-border py-3">
              <span className="text-[15px] text-fg">Daily target</span>
              <div className="flex min-w-0 items-center gap-2">
                <WheelPicker
                  label="Daily target"
                  value={targetNum}
                  min={1}
                  max={targetMaxRef.current}
                  onChange={(v) => setField('target', String(v))}
                  className="rounded-input"
                />
                <input
                  type="text"
                  aria-label="Unit"
                  value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  placeholder="pages, miles, minutes"
                  className="input-field h-12 min-w-0 flex-1 text-body"
                />
              </div>
            </div>
          </div>
        </div>

        {/* d · REPEAT: label + live summary, then the two centered wheels. */}
        <div className="border-t border-border pb-3 pt-2">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <span className="text-[15px] text-fg">Repeat</span>
            <span className="text-body text-fg-secondary">{repeatSummary(timesNum, daysNum)}</span>
          </div>

          {formError && (
            <p role="alert" className="mb-2 text-[13px] text-danger">
              {formError}
            </p>
          )}

          <div className="flex items-start justify-center gap-4 pt-1">
            <div className="flex flex-col items-center">
              <WheelPicker
                label="Times"
                value={timesNum}
                min={1}
                max={timesMaxRef.current}
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
                max={daysMaxRef.current}
                onChange={(v) => setField('freq_days', String(v))}
                className="rounded-input"
              />
              <span className="text-caption mt-1 text-fg-muted">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 · PREVIEW: how the tile will look on Today (shared with desktop). */}
      <div className="glass-card fade-up mt-3 rounded-card p-4" style={{ animationDelay: '80ms' }}>
        <p className="text-caption text-fg-muted">Preview</p>
        <div className="mt-3">
          <HabitPreview name={form.name} emoji={form.emoji} color={form.color} />
        </div>
      </div>

      {/* 5 · ACTIONS: sticky above the dock — Cancel (glass) + primary pill,
          same pair as the desktop layout. */}
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex gap-3 habit-form-actions">
        <button
          type="button"
          onClick={goBack}
          disabled={busy}
          className="glass-pill h-[52px] flex-1 rounded-pill px-4 text-body font-medium text-fg transition-colors duration-150 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="bg-accent-gradient glow-accent h-[52px] flex-1 rounded-pill px-4 text-body font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {busy && (
            <span
              aria-hidden="true"
              className="progress-spin size-4 rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create habit'}
        </button>
      </div>
    </form>
  )
}
