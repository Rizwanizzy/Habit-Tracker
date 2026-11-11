import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HabitPeriodPerformance } from '../lib/review'
import { HabitRowCompact, TrajectoryBadge } from './ReviewHabitRow'

interface Props {
  habits: HabitPeriodPerformance[]
  bestPerformers: HabitPeriodPerformance[]
  needsAttention: HabitPeriodPerformance[]
}

type FilterMode = 'all' | 'improving' | 'declining' | 'consistent'

export function ReviewHabitList({ habits, bestPerformers, needsAttention }: Props) {
  const [filter, setFilter] = useState<FilterMode>('all')

  const filteredHabits = habits.filter((item) => {
    if (filter === 'all') return true
    return item.trajectory === filter
  })

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full min-w-0">
      {/* Best Performers & Needs Attention Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        {/* Best Performers */}
        <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-semibold">
              ★
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-sm font-semibold text-fg truncate">
                Top Performers
              </span>
              <span className="text-[11px] text-fg-muted truncate">
                {bestPerformers.length > 0 ? 'Highest completion rate' : 'No habits with check-ins'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            {bestPerformers.length === 0 ? (
              <p className="text-xs text-fg-muted italic py-1">No completed habits this period.</p>
            ) : (
              bestPerformers.map((item) => (
                <HabitRowCompact key={item.habit.id} item={item} />
              ))
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 text-sm font-semibold">
              !
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-sm font-semibold text-fg truncate">
                Needs Attention
              </span>
              <span className="text-[11px] text-fg-muted truncate">
                {needsAttention.length > 0 ? 'Missed days or declining pace' : 'All habits on track'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            {needsAttention.length === 0 ? (
              <p className="text-xs text-emerald-500/90 font-medium py-1">
                Great job! No habits require urgent attention.
              </p>
            ) : (
              needsAttention.map((item) => (
                <HabitRowCompact key={item.habit.id} item={item} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* All Habits Breakdown & Trajectories */}
      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-5 flex flex-col gap-4 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-fg truncate">
              Habit Performance & Trajectory
            </h3>
            <p className="text-xs text-fg-muted">
              Individual rates and change vs previous completed period
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-hover/50 p-0.5 text-xs overflow-x-auto max-w-full shrink-0">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'improving', label: 'Improving' },
                { key: 'consistent', label: 'Consistent' },
                { key: 'declining', label: 'Declining' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setFilter(btn.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === btn.key
                    ? 'bg-accent-gradient text-white shadow-xs font-semibold'
                    : 'text-fg-secondary hover:text-fg'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Habit List Table / Rows */}
        <div className="flex flex-col divide-y divide-border/40 min-w-0">
          {filteredHabits.length === 0 ? (
            <p className="py-6 text-center text-xs text-fg-muted">
              No habits matching the selected filter.
            </p>
          ) : (
            filteredHabits.map((item) => (
              <Link
                key={item.habit.id}
                to={`/habits/${item.habit.id}`}
                className="group flex items-center justify-between gap-2.5 py-2.5 hover:bg-surface-hover/30 px-1.5 sm:px-2 rounded-lg transition-colors w-full min-w-0"
              >
                {/* Left: Emoji/Color + Habit Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.habit.emoji ? (
                    <span className="shrink-0 text-lg leading-none" aria-hidden="true">
                      {item.habit.emoji}
                    </span>
                  ) : (
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.habit.color }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium text-fg group-hover:text-accent transition-colors">
                      {item.habit.name}
                    </span>
                    <span className="text-[11px] text-fg-muted truncate">
                      {item.doneDays} of {item.eligibleDays} days completed
                      {item.missedDays > 0 && ` (${item.missedDays} missed)`}
                    </span>
                  </div>
                </div>

                {/* Right: Trajectory & Completion % */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <TrajectoryBadge item={item} />
                  <span className="font-heading text-sm font-semibold text-fg w-12 text-right">
                    {Math.round(item.completionRate * 100)}%
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
