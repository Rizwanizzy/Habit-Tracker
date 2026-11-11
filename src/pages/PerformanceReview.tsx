import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useVacationsContext } from '../contexts/VacationsContext'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useEntries } from '../hooks/useEntries'
import { vacationDatesInRange } from '../lib/vacation'
import {
  calculateMonthlyWeeklyBreakdown,
  calculatePeriodReview,
  calculateYearlyMonthlyBreakdown,
  generateActionableInsights,
  getCompletedMonthRange,
  getCompletedWeekRange,
  getCompletedYearRange,
  type PeriodRange,
} from '../lib/review'
import { ReviewPeriodNav, type PeriodType } from '../components/ReviewPeriodNav'
import { ReviewHeroCard } from '../components/ReviewHeroCard'
import { ReviewHabitList } from '../components/ReviewHabitList'
import { ReviewBreakdownCard } from '../components/ReviewBreakdownCard'
import { ReviewInsightsCard } from '../components/ReviewInsightsCard'

export function PerformanceReview() {
  const shared = useHabitsContext()
  const { loading: habitsLoading, error: habitsError, reload } = shared
  const habits = useMemo(() => shared.habits.filter((h) => !h.archived), [shared.habits])
  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])

  const today = useLogicalToday()
  const { periods } = useVacationsContext()

  // Fetch entries for up to 800 days back to cover yearly + previous-year comparisons
  const {
    entriesByHabit,
    loading: entriesLoading,
    error: entriesError,
  } = useEntries(habitIds, 800)

  const [periodType, setPeriodType] = useState<PeriodType>('weekly')
  const [offset, setOffset] = useState<number>(0)

  const handlePeriodTypeChange = (type: PeriodType) => {
    setPeriodType(type)
    setOffset(0) // Always reset to latest completed period
  }

  // Calculate current completed period range
  const currentRange = useMemo<PeriodRange>(() => {
    if (periodType === 'weekly') {
      return getCompletedWeekRange(today, offset)
    }
    if (periodType === 'monthly') {
      return getCompletedMonthRange(today, offset)
    }
    return getCompletedYearRange(today, offset)
  }, [periodType, today, offset])

  const vacations = useMemo(() => {
    return vacationDatesInRange(periods, currentRange.prevStart, currentRange.end)
  }, [periods, currentRange])

  // Calculate comprehensive review analysis
  const review = useMemo(() => {
    return calculatePeriodReview({
      habits,
      entriesByHabit,
      period: currentRange,
      today,
      vacations,
    })
  }, [habits, entriesByHabit, currentRange, today, vacations])

  // Calculate breakdowns for monthly/yearly
  const monthlyBreakdown = useMemo(() => {
    if (periodType !== 'monthly') return []
    return calculateMonthlyWeeklyBreakdown({
      habits,
      entriesByHabit,
      monthStart: currentRange.start,
      monthEnd: currentRange.end,
      today,
      vacations,
    })
  }, [periodType, habits, entriesByHabit, currentRange, today, vacations])

  const yearlyBreakdown = useMemo(() => {
    if (periodType !== 'yearly') return []
    return calculateYearlyMonthlyBreakdown({
      habits,
      entriesByHabit,
      year: Number(currentRange.start.slice(0, 4)),
      today,
      vacations,
    })
  }, [periodType, habits, entriesByHabit, currentRange, today, vacations])

  // Generate deterministic actionable suggestions
  const insights = useMemo(() => {
    return generateActionableInsights({ summary: review, periodType })
  }, [review, periodType])

  const isLoading = habitsLoading || entriesLoading
  const error = habitsError || entriesError

  const periodUnitName =
    periodType === 'weekly' ? 'week' : periodType === 'monthly' ? 'month' : 'year'

  const sublabel = `${currentRange.start} to ${currentRange.end}`

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5 sm:gap-6 pb-28 md:pb-12 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-fg">
          Performance Review
        </h1>
        <p className="text-xs sm:text-caption text-fg-muted">
          Retrospective habit analysis, progress comparisons, and actionable insights
        </p>
      </div>

      {/* Period Navigation */}
      <ReviewPeriodNav
        periodType={periodType}
        onPeriodTypeChange={handlePeriodTypeChange}
        label={currentRange.label}
        sublabel={sublabel}
        offset={offset}
        onPrev={() => setOffset((o) => o - 1)}
        onNext={() => setOffset((o) => Math.min(0, o + 1))}
        onResetToLatest={() => setOffset(0)}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 flex items-center justify-between">
          <span>Failed to load performance review data: {error}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-rose-500 text-white px-3 py-1 font-semibold hover:bg-rose-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-fg-muted gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-medium">Analyzing habit performance...</span>
        </div>
      )}

      {/* No habits empty state */}
      {!isLoading && !error && habits.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center flex flex-col items-center gap-3">
          <span className="text-3xl">📊</span>
          <h2 className="font-heading text-lg font-semibold text-fg">No Active Habits</h2>
          <p className="text-xs text-fg-muted max-w-sm">
            Create habits on the Today page to track your consistency and unlock weekly, monthly,
            and yearly performance reviews.
          </p>
          <Link
            to="/habits/new"
            className="mt-2 rounded-pill bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-accent/90 transition-colors"
          >
            Create your first habit
          </Link>
        </div>
      )}

      {/* Review Content */}
      {!isLoading && !error && habits.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Hero Card */}
          <ReviewHeroCard review={review} periodName={periodUnitName} />

          {/* Actionable Insights */}
          <ReviewInsightsCard insights={insights} />

          {/* Monthly or Yearly Breakdown */}
          {periodType === 'monthly' && monthlyBreakdown.length > 0 && (
            <ReviewBreakdownCard type="monthly" breakdown={monthlyBreakdown} />
          )}

          {periodType === 'yearly' && yearlyBreakdown.length > 0 && (
            <ReviewBreakdownCard type="yearly" breakdown={yearlyBreakdown} />
          )}

          {/* Habit Performance and Trajectory Lists */}
          <ReviewHabitList
            habits={review.habitPerformances}
            bestPerformers={review.bestPerformers}
            needsAttention={review.needsAttention}
          />
        </div>
      )}
    </div>
  )
}
