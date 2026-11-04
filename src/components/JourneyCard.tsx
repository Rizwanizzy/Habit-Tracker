import type { LifetimeStats } from '../lib/stats'
import type { Habit } from '../lib/score'
import { normalizeEmoji } from '../lib/emoji'

interface JourneyCardProps {
  stats: LifetimeStats
  loading: boolean
  error: string | null
  onRetry: () => void
  habits: Habit[]
}

export function JourneyCard({
  stats,
  loading,
  error,
  onRetry,
  habits,
}: JourneyCardProps) {
  const streakHabit = stats.longestStreak.habitId
    ? habits.find((h) => h.id === stats.longestStreak.habitId)
    : null

  const streakDays = stats.longestStreak.days
  const streakUnit = streakDays === 1 ? 'day' : 'days'

  return (
    <section aria-label="Your journey" className="glass-card rounded-card p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between pb-3.5 border-b border-border">
        <h2 className="text-base font-semibold text-fg">Your journey</h2>
        {stats.activeHabits > 0 && (
          <span className="text-xs text-fg-muted">
            {stats.activeHabits} active{stats.archivedHabits > 0 ? ` · ${stats.archivedHabits} archived` : ''}
          </span>
        )}
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-center justify-between rounded-input bg-danger/10 px-3.5 py-2.5">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="ml-3 shrink-0 rounded-pill px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4">
          <div className="p-4 border-r border-b border-border md:border-b-0 flex flex-col justify-between">
            <div className="skeleton h-3 w-20 rounded-pill" />
            <div className="skeleton my-2 h-7 w-16 rounded-pill" />
            <div className="skeleton h-3 w-24 rounded-pill" />
          </div>
          <div className="p-4 border-b border-border md:border-b-0 md:border-r flex flex-col justify-between">
            <div className="skeleton h-3 w-20 rounded-pill" />
            <div className="skeleton my-2 h-7 w-16 rounded-pill" />
            <div className="skeleton h-3 w-24 rounded-pill" />
          </div>
          <div className="p-4 border-r border-border md:border-r flex flex-col justify-between">
            <div className="skeleton h-3 w-20 rounded-pill" />
            <div className="skeleton my-2 h-7 w-16 rounded-pill" />
            <div className="skeleton h-3 w-24 rounded-pill" />
          </div>
          <div className="p-4 border-0 flex flex-col justify-between">
            <div className="skeleton h-3 w-20 rounded-pill" />
            <div className="skeleton my-2 h-7 w-16 rounded-pill" />
            <div className="skeleton h-3 w-24 rounded-pill" />
          </div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4">
          {/* Cell 0: Longest streak */}
          <div className="p-4 border-r border-b border-border md:border-b-0 flex flex-col justify-between min-w-0">
            <span className="text-xs font-normal normal-case tracking-normal text-fg-secondary">
              Longest streak
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
              <span className="font-sans font-bold tracking-tight text-fg tabular-nums text-[clamp(1.5rem,4vw,2.125rem)] leading-none">
                {streakDays}
              </span>
              <span className="text-sm font-normal text-fg-secondary whitespace-nowrap">
                {streakUnit}
              </span>
            </div>
            <div className="min-w-0">
              {streakHabit ? (
                <div
                  className="flex min-w-0 items-center gap-1.5 text-xs text-fg-secondary"
                  title={streakHabit.name}
                >
                  {normalizeEmoji(streakHabit.emoji) ? (
                    <span aria-hidden="true" className="shrink-0 leading-none text-xs">
                      {normalizeEmoji(streakHabit.emoji)}
                    </span>
                  ) : (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: streakHabit.color ?? '#3B82F6' }}
                    />
                  )}
                  <span className="min-w-0 truncate font-normal normal-case">
                    {streakHabit.name}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-fg-muted truncate block">
                  {streakDays > 0 ? 'All habits' : 'No streaks yet'}
                </span>
              )}
            </div>
          </div>

          {/* Cell 1: Total check-ins */}
          <div className="p-4 border-b border-border md:border-b-0 md:border-r flex flex-col justify-between min-w-0">
            <span className="text-xs font-normal normal-case tracking-normal text-fg-secondary whitespace-nowrap">
              Total check-ins
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
              <span className="font-sans font-bold tracking-tight text-fg tabular-nums text-[clamp(1.5rem,4vw,2.125rem)] leading-none">
                {stats.totalCheckIns}
              </span>
            </div>
            <span className="text-xs text-fg-muted truncate min-w-0 block">
              Lifetime completed
            </span>
          </div>

          {/* Cell 2: 30-day consistency */}
          <div className="p-4 border-r border-border md:border-r flex flex-col justify-between min-w-0">
            <span className="text-xs font-normal normal-case tracking-normal text-fg-secondary">
              30-day consistency
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
              <span className="font-sans font-bold tracking-tight text-fg tabular-nums text-[clamp(1.5rem,4vw,2.125rem)] leading-none">
                {stats.consistency30 !== null ? stats.consistency30 : '-'}
              </span>
              {stats.consistency30 !== null && (
                <span className="text-sm font-normal text-fg-secondary whitespace-nowrap">
                  %
                </span>
              )}
            </div>
            <span className="text-xs text-fg-muted truncate min-w-0 block">
              Last 30 days, active habits
            </span>
          </div>

          {/* Cell 3: Days tracking */}
          <div className="p-4 border-0 flex flex-col justify-between min-w-0">
            <span className="text-xs font-normal normal-case tracking-normal text-fg-secondary">
              Days tracking
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
              <span className="font-sans font-bold tracking-tight text-fg tabular-nums text-[clamp(1.5rem,4vw,2.125rem)] leading-none">
                {stats.daysTracking}
              </span>
            </div>
            <span className="text-xs text-fg-muted truncate min-w-0 block">
              Since first habit
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
