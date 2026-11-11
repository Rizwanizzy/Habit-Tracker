import { RangeSwitch } from './RangeSwitch'

export type PeriodType = 'weekly' | 'monthly' | 'yearly'

const PERIOD_OPTIONS = [
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
  { key: 'yearly', label: 'Year' },
]

interface Props {
  periodType: PeriodType
  onPeriodTypeChange: (type: PeriodType) => void
  label: string
  sublabel: string
  offset: number
  onPrev: () => void
  onNext: () => void
  onResetToLatest: () => void
}

export function ReviewPeriodNav({
  periodType,
  onPeriodTypeChange,
  label,
  sublabel,
  offset,
  onPrev,
  onNext,
  onResetToLatest,
}: Props) {
  const isLatest = offset === 0

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
      {/* Cadence Switcher: Week | Month | Year (full words everywhere) */}
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <RangeSwitch
          options={PERIOD_OPTIONS}
          value={periodType}
          onChange={(key) => onPeriodTypeChange(key as PeriodType)}
          ariaLabel="Select review period cadence"
          compact
          className="w-full sm:w-[220px]"
        />

        {!isLatest && (
          <button
            type="button"
            onClick={onResetToLatest}
            title="Jump to latest"
            className="inline-flex sm:hidden items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 bg-accent/10 hover:bg-accent/20 active:scale-95 transition-all shrink-0"
          >
            <span>Latest</span>
          </button>
        )}
      </div>

      {/* Period Navigator: 2-row stacked card on mobile, single row on desktop */}
      <div className="rounded-2xl border border-border bg-surface p-3 sm:py-1.5 sm:px-3.5 sm:rounded-xl shadow-xs flex items-center justify-between gap-2 sm:gap-3 min-w-0 sm:shrink-0">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous period"
          className="flex size-9 sm:size-8 items-center justify-center rounded-xl sm:rounded-lg text-fg-secondary hover:text-fg hover:bg-surface-hover active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
        >
          <svg viewBox="0 0 24 24" className="size-4 sm:size-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-2 text-center min-w-0 px-2 flex-1 sm:flex-initial">
          <div className="flex items-center gap-2 max-w-full">
            <span className="font-heading font-semibold text-sm sm:text-sm text-fg truncate">
              {label}
            </span>
            {!isLatest && (
              <button
                type="button"
                onClick={onResetToLatest}
                title="Jump to latest"
                className="hidden sm:inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors shrink-0"
              >
                Latest
              </button>
            )}
          </div>
          {sublabel && (
            <span className="text-[11px] sm:text-xs text-fg-muted truncate max-w-full sm:hidden">
              {sublabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={isLatest}
          aria-label="Next period"
          className={`flex size-9 sm:size-8 items-center justify-center rounded-xl sm:rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 ${
            isLatest
              ? 'opacity-30 cursor-not-allowed text-fg-muted'
              : 'text-fg-secondary hover:text-fg hover:bg-surface-hover active:scale-95'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-4 sm:size-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

