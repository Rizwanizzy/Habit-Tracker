import type { ActionableInsight } from '../lib/review'
import { IconSparkles, IconTrendingUp } from './icons'

interface Props {
  insights: ActionableInsight[]
}

export function ReviewInsightsCard({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-3.5 w-full min-w-0">
      <div className="flex items-center gap-2">
        <IconSparkles className="size-4 text-accent" />
        <h3 className="font-heading text-base font-semibold text-fg">
          Actionable Insights
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors min-w-0 ${
              insight.kind === 'celebration'
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : insight.kind === 'improvement'
                  ? 'border-indigo-500/20 bg-indigo-500/5'
                  : insight.kind === 'focus'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-border/60 bg-surface-hover/30'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {insight.kind === 'celebration' && (
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold">
                  ✓
                </span>
              )}
              {insight.kind === 'improvement' && (
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-500 text-xs">
                  <IconTrendingUp className="size-3.5" />
                </span>
              )}
              {insight.kind === 'focus' && (
                <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 text-xs font-bold">
                  !
                </span>
              )}
              {insight.kind === 'tip' && (
                <span className="flex size-6 items-center justify-center rounded-full bg-fg-muted/15 text-fg-muted text-xs">
                  i
                </span>
              )}
            </span>

            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-semibold text-fg">
                {insight.title}
              </span>
              <p className="text-xs text-fg-secondary leading-relaxed">
                {insight.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
