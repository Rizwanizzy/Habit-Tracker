import { addDays, parseLocalDate } from '../lib/dates'
import { isDone, type Entry, type Habit } from '../lib/score'

const DAYS = 7

interface Props {
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  today: string
}

const DAY_FMT = new Intl.DateTimeFormat('en', { weekday: 'short' })
const TITLE_FMT = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })

type DayPoint = { date: string; eligible: number; done: number; label: string; title: string }

/** Weekly completion mini chart (DESIGN.md §8): the last 7 days, one bar per
 *  day showing the share of that day's eligible habits that were done.
 *  Plain SVG-like CSS bars — no extra dependency. */
export function WeeklyCompletion({ habits, entriesByHabit, today }: Props) {
  const days: DayPoint[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const eligible = habits.filter((h) => h.created_at <= date)
    const done = eligible.filter((h) =>
      isDone(h, (entriesByHabit[h.id] ?? []).find((e) => e.date === date)),
    ).length
    days.push({
      date,
      eligible: eligible.length,
      done,
      label: DAY_FMT.format(parseLocalDate(date)),
      title: TITLE_FMT.format(parseLocalDate(date)),
    })
  }

  const weekDone = days.reduce((sum, d) => sum + d.done, 0)
  const weekEligible = days.reduce((sum, d) => sum + d.eligible, 0)
  const isEmpty = weekDone === 0 || weekEligible === 0

  return (
    <section
      className="glass-card fade-up rounded-card p-5 lg:p-6"
      style={{ animationDelay: '40ms' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section-title text-fg">This week</h2>
        <p className="text-caption text-fg-muted">% done per day</p>
      </div>

      {isEmpty ? (
        <p className="mt-6 text-body text-fg-secondary">
          Check in a habit to see your weekly progress.
        </p>
      ) : (
        <div className="mt-5">
          <div className="flex h-28 items-end gap-1.5 sm:gap-2.5">
            {days.map((d, i) => {
              const frac = d.eligible ? d.done / d.eligible : 0
              const isToday = i === DAYS - 1
              return (
                <div
                  key={d.date}
                  role="img"
                  aria-label={`${d.title} — ${d.done} of ${d.eligible} done`}
                  title={`${d.title} — ${d.done} of ${d.eligible} done`}
                  className="h-full w-full overflow-hidden rounded-pill bg-fg/10"
                >
                  <div
                    className="bar-in w-full rounded-pill transition-[height] duration-300"
                    style={{
                      height: `${Math.round(frac * 100)}%`,
                      backgroundColor: isToday
                        ? 'var(--accent)'
                        : 'color-mix(in srgb, var(--accent) 45%, transparent)',
                      boxShadow: isToday
                        ? '0 0 12px color-mix(in srgb, var(--accent) 55%, transparent)'
                        : undefined,
                      animationDelay: `${i * 40}ms`,
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {days.map((d, i) => (
              <p
                key={d.date}
                className={`text-caption text-center ${i === DAYS - 1 ? 'text-fg' : 'text-fg-muted'}`}
              >
                {d.label}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
