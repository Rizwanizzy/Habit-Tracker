import { Link } from 'react-router-dom'
import type { HabitPeriodPerformance } from '../lib/review'
import { IconTrendingDown, IconTrendingUp } from './icons'

export function HabitRowCompact({ item }: { item: HabitPeriodPerformance }) {
  return (
    <Link
      to={`/habits/${item.habit.id}`}
      className="group flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-surface-hover/50 transition-colors min-w-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        {item.habit.emoji ? (
          <span className="text-base shrink-0 leading-none" aria-hidden="true">
            {item.habit.emoji}
          </span>
        ) : (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.habit.color }}
            aria-hidden="true"
          />
        )}
        <span className="truncate text-xs font-medium text-fg group-hover:text-accent transition-colors">
          {item.habit.name}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] font-semibold text-fg">
          {Math.round(item.completionRate * 100)}%
        </span>
        <span className="text-[10px] text-fg-muted">
          ({item.doneDays}/{item.eligibleDays})
        </span>
      </div>
    </Link>
  )
}

export function TrajectoryBadge({ item }: { item: HabitPeriodPerformance }) {
  if (item.trajectory === 'new') {
    return (
      <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-fg-muted">
        New
      </span>
    )
  }

  const deltaPct = item.deltaRate !== null ? Math.round(item.deltaRate * 100) : 0

  if (item.trajectory === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
        <IconTrendingUp className="size-3" />
        {deltaPct > 0 ? `+${deltaPct}%` : 'Up'}
      </span>
    )
  }

  if (item.trajectory === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
        <IconTrendingDown className="size-3" />
        {deltaPct < 0 ? `${deltaPct}%` : 'Down'}
      </span>
    )
  }

  return (
    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-fg-muted">
      Stable
    </span>
  )
}
