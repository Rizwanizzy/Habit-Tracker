import type { MonthlyWeekBreakdown, YearlyMonthBreakdown } from '../lib/review'

interface MonthlyProps {
  type: 'monthly'
  breakdown: MonthlyWeekBreakdown[]
}

interface YearlyProps {
  type: 'yearly'
  breakdown: YearlyMonthBreakdown[]
}

type Props = MonthlyProps | YearlyProps

export function ReviewBreakdownCard(props: Props) {
  if (props.type === 'monthly') {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-4 w-full min-w-0">
        <div>
          <h3 className="font-heading text-base font-semibold text-fg">
            Weekly Breakdown in Month
          </h3>
          <p className="text-xs text-fg-muted">
            Track how consistency progressed through each week of the month
          </p>
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          {props.breakdown.map((week) => {
            const pct = Math.round(week.completionRate * 100)
            return (
              <div key={week.weekIndex} className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                  <span className="font-medium text-fg truncate">
                    {week.label} ({week.startDate.slice(5)} to {week.endDate.slice(5)})
                  </span>
                  <span className="font-heading font-semibold text-fg shrink-0">
                    {pct}%{' '}
                    <span className="font-normal text-[11px] text-fg-muted">
                      ({week.totalDone}/{week.totalEligible})
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, pct))}%`,
                      backgroundColor:
                        pct >= 80
                          ? 'var(--color-success, #10b981)'
                          : pct >= 50
                            ? 'var(--color-accent, #6366f1)'
                            : 'var(--color-warning, #f59e0b)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-4 w-full min-w-0">
      <div>
        <h3 className="font-heading text-base font-semibold text-fg">
          Month-by-Month Progress
        </h3>
        <p className="text-xs text-fg-muted">
          Yearly consistency across all 12 calendar months
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
        {props.breakdown.map((m) => {
          const isEligible = m.totalEligible > 0
          const pct = Math.round(m.completionRate * 100)
          return (
            <div
              key={m.month}
              className={`flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors ${
                isEligible ? 'border-border/60 bg-surface-hover/20' : 'border-border/30 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-fg">{m.name}</span>
                <span className="font-heading font-bold text-fg">
                  {isEligible ? `${pct}%` : '—'}
                </span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    backgroundColor:
                      pct >= 80
                        ? 'var(--color-success, #10b981)'
                        : pct >= 50
                          ? 'var(--color-accent, #6366f1)'
                          : 'var(--color-warning, #f59e0b)',
                  }}
                />
              </div>

              <span className="text-[10px] text-fg-muted text-right">
                {isEligible ? `${m.totalDone}/${m.totalEligible}` : 'No data'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
