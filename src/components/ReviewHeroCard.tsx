import type { PeriodReviewSummary } from '../lib/review'
import { DeltaChip } from './StatTile'

interface Props {
  review: PeriodReviewSummary
  periodName: string
}

export function ReviewHeroCard({ review, periodName }: Props) {
  const {
    overallCompletionRate,
    completionDelta,
    totalCheckIns,
    totalEligibleOpportunities,
    activeHabitsCount,
    overallScore,
  } = review

  const ratePct = Math.round(overallCompletionRate * 100)
  const deltaPct = completionDelta !== null ? Math.round(completionDelta * 100) : null

  const deltaDirection = deltaPct !== null && deltaPct >= 0 ? 'up' : 'down'
  const deltaTone = deltaPct === null || deltaPct >= 0 ? 'success' : 'danger'
  const deltaText =
    deltaPct !== null
      ? `${deltaPct > 0 ? '+' : ''}${deltaPct}% vs prev ${periodName}`
      : 'No prior period'

  const scorePct = Math.round(overallScore * 100)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm w-full min-w-0">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-15 blur-2xl"
        style={{
          background:
            ratePct >= 80
              ? 'radial-gradient(circle, var(--color-success, #10b981) 0%, transparent 70%)'
              : ratePct >= 50
                ? 'radial-gradient(circle, var(--color-accent, #6366f1) 0%, transparent 70%)'
                : 'radial-gradient(circle, var(--color-warning, #f59e0b) 0%, transparent 70%)',
        }}
      />

      <div className="flex flex-col gap-3.5 sm:gap-5 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-caption font-medium uppercase tracking-wider text-fg-muted truncate">
            Overall Completion Rate
          </span>
          <div className="shrink-0">
            <DeltaChip direction={deltaDirection} text={deltaText} tone={deltaTone} />
          </div>
        </div>

        {/* Hero numeral */}
        <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 min-w-0">
          <span className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-fg">
            {ratePct}%
          </span>
          <span className="text-caption text-fg-muted">
            of eligible habit opportunities
          </span>
        </div>

        {/* Visual progress bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, ratePct))}%`,
              background: 'linear-gradient(90deg, var(--color-accent) 0%, #10b981 100%)',
            }}
          />
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center sm:text-left">
          <div className="flex flex-col">
            <span className="text-caption text-fg-muted">Completed</span>
            <span className="font-heading text-base sm:text-lg font-semibold text-fg">
              {totalCheckIns}
              <span className="text-xs font-normal text-fg-muted"> / {totalEligibleOpportunities}</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-caption text-fg-muted">Habits</span>
            <span className="font-heading text-base sm:text-lg font-semibold text-fg">
              {activeHabitsCount}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-caption text-fg-muted">Avg Score</span>
            <span className="font-heading text-base sm:text-lg font-semibold text-fg">
              {scorePct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
