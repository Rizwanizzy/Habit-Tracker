import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ColorPicker } from '../components/ColorPicker'
import { createHabit, extractError, updateHabit, type HabitInput } from '../hooks/useHabits'
import { getSupabase } from '../lib/supabase'

const DEFAULT_COLOR = '#3B82F6'

type FormState = {
  name: string
  type: 'boolean' | 'numeric'
  target: string
  unit: string
  freq_times: string
  freq_days: string
  color: string
}

const BLANK: FormState = {
  name: '',
  type: 'boolean',
  target: '1',
  unit: '',
  freq_times: '1',
  freq_days: '1',
  color: DEFAULT_COLOR,
}

const inputClass =
  'mt-2 h-11 w-full rounded-button border border-border bg-surface px-3 text-body text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none'

export function HabitForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)

  const [form, setForm] = useState<FormState | null>(editing ? null : BLANK)
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
      <div className="grid place-items-center rounded-card border border-border bg-surface-raised p-10" role="status">
        <span className="text-body text-fg-muted">Loading…</span>
      </div>
    )
  }
  if (loadError || !form) {
    return (
      <section>
        <h1 className="text-page-title">{editing ? 'Edit habit' : 'Add habit'}</h1>
        <div className="mt-6 rounded-card border border-danger bg-danger/10 p-6 text-center" role="alert">
          <p className="text-body text-danger">{loadError ?? 'Habit not found.'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 h-11 rounded-button border border-border px-4 text-body font-medium text-fg-secondary"
        >
          Back to Today
        </button>
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
    }
    setFormError(null)
    setBusy(true)
    try {
      if (id) await updateHabit(id, values)
      else await createHabit(values)
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  const isNumeric = form.type === 'numeric'

  return (
    <section>
      <h1 className="text-page-title">{editing ? 'Edit habit' : 'Add habit'}</h1>
      <form onSubmit={save} className="mt-6 rounded-card border border-border bg-surface-raised p-6">
        <label htmlFor="habit-name" className="block font-medium text-fg-secondary text-body">
          Name
        </label>
        <input
          id="habit-name"
          type="text"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g., Meditate, Read 10 pages"
          className={inputClass}
        />

        <span className="mt-4 block font-medium text-fg-secondary text-body">Type</span>
        <div className="mt-2 flex gap-2" role="group" aria-label="Habit type">
          {(['boolean', 'numeric'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              aria-pressed={form.type === t}
              className={`h-11 flex-1 rounded-button border text-body font-medium transition-colors duration-150 ${
                form.type === t
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-fg-secondary hover:bg-surface-raised'
              }`}
            >
              {t === 'boolean' ? 'Yes / no' : 'Numeric'}
            </button>
          ))}
        </div>

        {isNumeric && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="habit-target" className="block font-medium text-fg-secondary text-body">
                Daily target
              </label>
              <input
                id="habit-target"
                type="number"
                min="0"
                step="any"
                value={form.target}
                onChange={(e) => set('target', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="habit-unit" className="block font-medium text-fg-secondary text-body">
                Unit
              </label>
              <input
                id="habit-unit"
                type="text"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="pages, miles, minutes"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="habit-times" className="block font-medium text-fg-secondary text-body">
              Times
            </label>
            <input
              id="habit-times"
              type="number"
              min="1"
              value={form.freq_times}
              onChange={(e) => set('freq_times', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="habit-days" className="block font-medium text-fg-secondary text-body">
              Per days
            </label>
            <input
              id="habit-days"
              type="number"
              min="1"
              value={form.freq_days}
              onChange={(e) => set('freq_days', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="mt-1 text-caption text-fg-muted">
          e.g., 2 times per 7 days = twice a week; habits scoring refresh accordingly.
        </p>

        <div className="mt-4">
          <ColorPicker color={form.color} onChange={(hex) => set('color', hex)} />
        </div>

        {formError && (
          <p role="alert" className="mt-4 rounded-button bg-danger/10 px-3 py-2 text-caption text-danger">
            {formError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={busy}
            className="h-11 flex-1 rounded-button border border-border text-body font-medium text-fg transition-colors duration-150 hover:bg-surface disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-11 flex-1 rounded-button bg-accent text-body font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </form>
    </section>
  )
}