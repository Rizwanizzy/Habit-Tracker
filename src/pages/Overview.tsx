import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useEntries } from '../hooks/useEntries'
import { scoreSeries } from '../lib/score'
import { addDays } from '../lib/dates'
import { vacationDatesInRange } from '../lib/vacation'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useVacationsContext } from '../contexts/VacationsContext'
import { tint } from '../lib/color'
import { normalizeEmoji } from '../lib/emoji'
import { StatTile, DeltaChip, HabitDotName } from '../components/StatTile'
import { RangeSwitch } from '../components/RangeSwitch'
import { ScoreLineChart, type ChartRow } from '../components/ScoreLineChart'

type RangeKey = '30' | '90' | '365'

const RANGES: { key: RangeKey; label: string; short: string }[] = [
  { key: '30', label: '30 days', short: '30d' },
  { key: '90', label: '90 days', short: '90d' },
  { key: '365', label: '1 year', short: '1y' },
]

const pct = (score: number) => Math.round(score * 100)

export function Overview() {
  const shared = useHabitsContext()
  const { loading, error, reload } = shared
  const habits = useMemo(() => shared.habits.filter((h) => !h.archived), [shared.habits])
  const ids = habits.map((h) => h.id)
  const { entriesByHabit, loading: entriesLoading, error: entriesError } = useEntries(ids, 400)

  const today = useLogicalToday()
  const { periods } = useVacationsContext()
  const [range, setRange] = useState<RangeKey>('90')
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

  const names = useMemo(() => new Map(habits.map((h) => [h.id, h.name ?? h.id])), [habits])

  /** Per-habit score series for the selected range, plus the equal-length
   *  window just before it (for the average-score delta chip). Vacation
   *  dates cover both windows (max span = 2× the range, entries window 400). */
  const per = useMemo(() => {
    const days = Number(range)
    const start = addDays(today, -(days - 1))
    const vacations = vacationDatesInRange(periods, addDays(start, -days), today)
    return habits.map((habit) => ({
      habit,
      series: scoreSeries(habit, entriesByHabit[habit.id] ?? [], start, today, vacations),
      prev: scoreSeries(
        habit,
        entriesByHabit[habit.id] ?? [],
        addDays(start, -days),
        addDays(start, -1),
        vacations,
      ),
    }))
  }, [habits, entriesByHabit, range, today, periods])

  const stats = useMemo(() => {
    const finals = per.map((p) => ({ habit: p.habit, score: p.series.at(-1)?.score ?? 0 }))
    if (finals.length === 0) return { avg: 0, best: null, worst: null, prevAvg: null, per }
    const avg = finals.reduce((s, f) => s + f.score, 0) / finals.length
    const best = finals.reduce((m, f) => (f.score > m.score ? f : m), finals[0])
    const worst = finals.reduce((m, f) => (f.score < m.score ? f : m), finals[0])
    const prevScores = per.filter((p) => p.prev.length > 0).map((p) => p.prev.at(-1)?.score ?? 0)
    const prevAvg = prevScores.length
      ? prevScores.reduce((s, x) => s + x, 0) / prevScores.length
      : null
    return { avg, best, worst, prevAvg, per }
  }, [per])

  /** One row per date; `g:` keys duplicate each value for the wide glow line
   *  the tooltip filters out. */
  const data = useMemo(() => {
    const rows = new Map<string, ChartRow>()
    for (const item of stats.per) {
      for (const p of item.series) {
        const row = rows.get(p.date) ?? { date: p.date }
        const value = Math.round(p.score * 100)
        row[item.habit.id] = value
        row[`g:${item.habit.id}`] = value
        rows.set(p.date, row)
      }
    }
    return [...rows.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [stats.per])

  if (loading || entriesLoading) {
    return (
      <div className="glass-card grid min-h-32 place-items-center rounded-card p-10" role="status">
        <span className="text-body text-fg-muted">Loading…</span>
      </div>
    )
  }

  if (error ?? entriesError) {
    const msg = error ?? entriesError
    return (
      <div className="glass-card rounded-card p-6 text-center" role="alert">
        <p className="text-body text-danger">{msg}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 h-11 rounded-pill border border-danger px-4 text-body font-medium text-danger"
        >
          Retry
        </button>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <section>
        <h1 className="text-page-title">Overview</h1>
        <p className="text-caption mt-1 text-fg-muted">Score trends for your active habits</p>
        <div className="glass-card mt-6 rounded-card p-6 text-center">
          <p className="text-body text-fg-secondary">Nothing to show yet.</p>
          <p className="mt-1 text-caption text-fg-muted">
            Charts and stats will appear once you have habits and check-ins.
          </p>
          <Link
            to="/habits/new"
            className="mt-4 inline-flex h-12 items-center rounded-pill bg-accent-gradient px-5 text-body font-semibold text-white transition-all duration-150 hover:brightness-110"
          >
            Add habit
          </Link>
        </div>
      </section>
    )
  }

  const visible = habits.filter((h) => !hidden.has(h.id))
  const deltaPct = stats.prevAvg == null ? null : pct(stats.avg) - pct(stats.prevAvg)
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? ''

  // habits.length > 0 here, so best/worst are always set; the fallbacks are
  // just for the type checker.
  const fallback = { habit: habits[0], score: 0 }
  const best = stats.best ?? fallback
  const worst = stats.worst ?? fallback

  return (
    <section className="max-sm:flex max-sm:flex-col max-sm:flex-1 max-sm:min-h-[calc(100svh_-_6.5rem_-_env(safe-area-inset-bottom))]">
      {/* Header with the range switch (DESIGN.md §8) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title">Overview</h1>
          <p className="text-caption mt-1 text-fg-muted">Score trends for your active habits</p>
        </div>
        <RangeSwitch
          options={RANGES.map(({ key, label }) => ({ key, label }))}
          value={range}
          onChange={(k) => setRange(k as RangeKey)}
          ariaLabel="Score chart range"
        />
      </header>

      {/* Row 1: stat tiles.
          Mobile (≤639px): compact tiles, 3 per row, delta on the same row as
          the numeral. Desktop (≥640px): the ORIGINAL layout, unchanged. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <StatTile
          label="Avg score"
          numeral={`${pct(stats.avg)}%`}
          footnote={`vs previous ${rangeLabel}`}
          compact
          delta={
            deltaPct != null && deltaPct !== 0 ? (
              <DeltaChip
                direction={deltaPct > 0 ? 'up' : 'down'}
                text={`${Math.abs(deltaPct)}%`}
                tone={deltaPct > 0 ? 'success' : 'danger'}
              />
            ) : undefined
          }
        />
        <StatTile
          label="Best habit"
          numeral={`${pct(best.score)}%`}
          delay={40}
          to={`/habits/${best.habit.id}`}
          linkLabel={`Open ${best.habit.name ?? 'habit'} details`}
          compact
          delta={<DeltaChip direction="up" text={`${pct(best.score)}%`} tone="success" />}
        >
          <HabitDotName
            color={best.habit.color ?? '#3B82F6'}
            name={best.habit.name ?? 'Habit'}
            emoji={normalizeEmoji(best.habit.emoji)}
            compact
          />
        </StatTile>
        <StatTile
          label="Need Attention"
          numeral={`${pct(worst.score)}%`}
          delay={80}
          to={`/habits/${worst.habit.id}`}
          linkLabel={`Open ${worst.habit.name ?? 'habit'} details`}
          compact
          delta={<DeltaChip direction="down" text={`${pct(worst.score)}%`} tone="danger" />}
        >
          <HabitDotName
            color={worst.habit.color ?? '#3B82F6'}
            name={worst.habit.name ?? 'Habit'}
            emoji={normalizeEmoji(worst.habit.emoji)}
            compact
          />
        </StatTile>
      </div>
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-3 lg:gap-5">
        <StatTile label="Avg score" numeral={`${pct(stats.avg)}%`} footnote={`vs previous ${rangeLabel}`}>
          {deltaPct != null && deltaPct !== 0 && (
            <DeltaChip
              direction={deltaPct > 0 ? 'up' : 'down'}
              text={`${Math.abs(deltaPct)}%`}
              tone={deltaPct > 0 ? 'success' : 'danger'}
            />
          )}
        </StatTile>
        <StatTile
          label="Best habit"
          numeral={`${pct(best.score)}%`}
          delay={40}
          to={`/habits/${best.habit.id}`}
          linkLabel={`Open ${best.habit.name ?? 'habit'} details`}
        >
          <DeltaChip direction="up" text={`${pct(best.score)}%`} tone="success" />
          <HabitDotName color={best.habit.color ?? '#3B82F6'} name={best.habit.name ?? 'Habit'} emoji={normalizeEmoji(best.habit.emoji)} />
        </StatTile>
        <StatTile
          label="Needs attention"
          numeral={`${pct(worst.score)}%`}
          delay={80}
          to={`/habits/${worst.habit.id}`}
          linkLabel={`Open ${worst.habit.name ?? 'habit'} details`}
        >
          <DeltaChip direction="down" text={`${pct(worst.score)}%`} tone="danger" />
          <HabitDotName color={worst.habit.color ?? '#3B82F6'} name={worst.habit.name ?? 'Habit'} emoji={normalizeEmoji(worst.habit.emoji)} />
        </StatTile>
      </div>

      {/* Row 2: chart card with the habit chips inside it.
          Mobile: the page column is height-filled down to the dock reserve
          (see the root section) and this card + chart grow to absorb the
          slack so no idle strip is left above the dock. Desktop unchanged. */}
      <section
        className="glass-card fade-up mt-4 rounded-card p-5 max-sm:flex max-sm:flex-1 max-sm:flex-col lg:mt-5 lg:p-6"
        style={{ animationDelay: '120ms' }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-section-title text-fg">Score</h2>
          <p className="text-caption text-fg-muted">Exponential average per habit</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show or hide habit lines">
          {habits.map((habit) => {
            const color = habit.color ?? '#3B82F6'
            const emoji = normalizeEmoji(habit.emoji)
            const isOff = hidden.has(habit.id)
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev)
                    if (next.has(habit.id)) next.delete(habit.id)
                    else next.add(habit.id)
                    return next
                  })
                }
                aria-pressed={!isOff}
                title={habit.name}
                className="relative grid size-10 shrink-0 place-items-center rounded-full text-lg leading-none transition-all duration-150 after:absolute after:inset-[-4px] after:content-[''] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={
                  isOff
                    ? { opacity: 0.35, border: `1px solid var(--border)`, backgroundColor: 'transparent' }
                    : { backgroundColor: tint(color, 20), border: `2px solid ${tint(color, 50)}` }
                }
              >
                {emoji ? (
                  <span aria-hidden="true" className="leading-none">
                    {emoji}
                  </span>
                ) : (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                )}
                <span className="sr-only">{habit.name}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 max-sm:relative max-sm:flex-1 max-sm:min-h-56">
          <ScoreLineChart data={data} visible={visible} names={names} />
        </div>
      </section>
    </section>
  )
}
