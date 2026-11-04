import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ColorPicker } from '../components/ColorPicker'
import { EmojiPickerField } from '../components/EmojiPickerField'
import { HabitPreview } from '../components/HabitPreview'
import { RangeSwitch } from '../components/RangeSwitch'
import { HabitFormMobile } from '../components/HabitFormMobile'
import { createHabit, extractError, updateHabit, type HabitInput } from '../hooks/useHabits'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useSettings } from '../contexts/SettingsContext'
import { getSupabase } from '../lib/supabase'
import { normalizeEmoji } from '../lib/emoji'
import { FORM_BLANK, type FormState } from '../types/habit-form'

const Label = ({ htmlFor, children }: { htmlFor: string; children: string }) => (
  <label htmlFor={htmlFor} className="text-caption block text-fg-muted">
    {children}
  </label>
)

export function HabitForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reload } = useHabitsContext()
  const { dayStartHour } = useSettings()
  const editing = Boolean(id)

  const [form, setForm] = useState<FormState | null>(editing ? null : FORM_BLANK)
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data, error } = await sb.from('habits').select('*').eq('id', id).single()
        if (error) throw error
        if (!active) return
        setForm({
          name: data.name,
          emoji: data.emoji ?? '',
          type: data.type,
          target: String(data.target),
          unit: data.unit ?? '',
          freq_times: String(data.freq_times),
          freq_days: String(data.freq_days),
          color: data.color,
        })
      } catch (e) {
        if (active) setLoadError(extractError(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="glass-card grid min-h-40 place-items-center rounded-card p-10" role="status">
        <span className="text-body text-fg-muted">Loading…</span>
      </div>
    )
  }
  if (loadError || !form) {
    return (
      <section>
        <h1 className="text-page-title">{editing ? 'Edit habit' : 'Add habit'}</h1>
        <div className="glass-card mt-6 rounded-card p-6 text-center" role="alert">
          <p className="text-body text-danger">{loadError ?? 'Habit not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="glass-pill mt-4 h-12 rounded-pill px-5 text-body font-medium text-fg"
          >
            Back to Today
          </button>
        </div>
      </section>
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const name = form.name.trim()
    if (!name) {
      setFormError('Please give the habit a name.')
      return
    }
    const target = Number(form.target)
    const freqTimes = Math.max(1, Math.floor(Number(form.freq_times) || 1))
    const freqDays = Math.max(1, Math.floor(Number(form.freq_days) || 1))
    if (form.type === 'numeric' && !(target > 0)) {
      setFormError('The daily target must be a number greater than 0.')
      return
    }
    const values: HabitInput = {
      name,
      type: form.type,
      target: form.type === 'numeric' ? target : 1,
      unit: form.type === 'numeric' ? form.unit.trim() : null,
      freq_times: freqTimes,
      freq_days: freqDays,
      color: form.color,
      emoji: normalizeEmoji(form.emoji),
    }
    setFormError(null)
    setBusy(true)
    try {
      if (id) await updateHabit(id, values, dayStartHour)
      else await createHabit(values, dayStartHour)
      // Refresh the shared habit list immediately so Today/Overview/Settings
      // show the change; navigation happens right away (same loading state
      // users saw when each page fetched on mount).
      void reload()
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const isNumeric = form.type === 'numeric'
  const c = form.color

  return (
    <section>
      {/* ── Phone layout (below lg): shared state, separate <form>. ── */}
      <div className="lg:hidden">
        <HabitFormMobile
          editing={editing}
          busy={busy}
          form={form}
          formError={formError}
          setField={set}
          setColor={(hex) => set('color', hex)}
          onSubmit={(e: FormEvent<HTMLFormElement>) => save(e)}
        />
      </div>

      {/* ── Desktop / tablet layout (lg+): the original form, byte-identical
             markup and behaviour. `hidden lg:block` keeps phones off it so
             the two hidden twin forms never show at once. ── */}
      <div className="hidden lg:block">
        <header className="mb-5">
          <h1 className="text-page-title">{editing ? 'Edit habit' : 'Add habit'}</h1>
          <p className="text-caption mt-1 text-fg-muted">
            {editing ? 'Update the details of your habit' : 'Something you want to repeat'}
          </p>
        </header>

        {/* Details left, color right (two columns on desktop, DESIGN.md §10). */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <form onSubmit={save} id="habit-form" className="glass-card fade-up rounded-card p-6">
            <Label htmlFor="habit-name">Name</Label>
            <input
              id="habit-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Meditate, Read 10 pages"
              className="input-field mt-2"
            />

            <span className="text-caption mt-5 block text-fg-muted">Emoji (optional)</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EmojiPickerField
                value={form.emoji}
                color={form.color}
                onChange={(emoji) => set('emoji', emoji)}
              />
              <input
                id="habit-emoji"
                type="text"
                value={form.emoji}
                onChange={(e) => set('emoji', e.target.value)}
                placeholder="🙂"
                aria-label="Or paste an emoji"
                className="h-12 w-16 shrink-0 rounded-input border border-border bg-surface-raised px-2 text-center text-xl text-fg focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {form.emoji && (
                <button
                  type="button"
                  onClick={() => set('emoji', '')}
                  className="glass-pill h-11 shrink-0 rounded-pill px-3 text-caption text-fg-secondary transition-colors duration-150 hover:text-fg"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-caption mt-2 text-fg-muted">
              Search the full emoji set, or paste one. It shows inside the tile&apos;s check circle
              so the habit stays recognisable when its name is cut off.
            </p>

            <span className="text-caption mt-5 block text-fg-muted">Type</span>
            <div className="mt-2 w-full">
              <RangeSwitch
                options={[
                  { key: 'boolean', label: 'Yes / no' },
                  { key: 'numeric', label: 'Numeric' },
                ]}
                value={form.type}
                onChange={(k) => set('type', k as FormState['type'])}
                ariaLabel="Habit type"
              />
            </div>

            {isNumeric && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="habit-target">Daily target</Label>
                  <input
                    id="habit-target"
                    type="number"
                    min="0"
                    step="any"
                    value={form.target}
                    onChange={(e) => set('target', e.target.value)}
                    className="input-field mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="habit-unit">Unit</Label>
                  <input
                    id="habit-unit"
                    type="text"
                    value={form.unit}
                    onChange={(e) => set('unit', e.target.value)}
                    placeholder="pages, miles, minutes"
                    className="input-field mt-2"
                  />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="habit-times">Times</Label>
                <input
                  id="habit-times"
                  type="number"
                  min="1"
                  value={form.freq_times}
                  onChange={(e) => set('freq_times', e.target.value)}
                  className="input-field mt-2"
                />
              </div>
              <div>
                <Label htmlFor="habit-days">Per days</Label>
                <input
                  id="habit-days"
                  type="number"
                  min="1"
                  value={form.freq_days}
                  onChange={(e) => set('freq_days', e.target.value)}
                  className="input-field mt-2"
                />
              </div>
            </div>
            <p className="text-caption mt-2 text-fg-muted">e.g., 2 times per 7 days = twice a week</p>
          </form>

          <div className="glass-card fade-up rounded-card p-6" style={{ animationDelay: '40ms' }}>
            <ColorPicker color={c} onChange={(hex) => set('color', hex)} />

            {/* Live preview: how the habit tile will look on Today. */}
            <p className="text-caption mt-6 text-fg-muted">Preview</p>
            <div className="mt-3">
              <HabitPreview name={form.name} emoji={form.emoji} color={c} />
            </div>
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
            {formError}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={busy}
            className="glass-pill h-12 flex-1 rounded-pill px-4 text-body font-medium text-fg transition-colors duration-150 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="habit-form"
            disabled={busy}
            className="bg-accent-gradient glow-accent h-12 flex-1 rounded-pill px-4 text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </div>
    </section>
  )
}
