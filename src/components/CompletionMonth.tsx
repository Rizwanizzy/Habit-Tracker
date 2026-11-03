import { readableColor } from '../lib/color'
import { intensityPct, type CalendarCell, type DayCompletion } from '../lib/completion'
import { parseLocalDate } from '../lib/dates'
import { useThemeName } from '../hooks/useThemeName'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const TITLE_FMT = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })

interface Props {
  /** 7-column Sun–Sat calendar weeks around the current month (null = blank). */
  weeks: CalendarCell[][]
  completions: Map<string, DayCompletion>
  color: string
  today: string
}

/** Month view (DESIGN.md §8): calendar grid for the current month — one cell
 *  per day. Days up to and including today are filled with the chosen color
 *  at an intensity that follows the day's completion share (lighter = less,
 *  darker = more). Upcoming days (after today) are greyed out, not clickable,
 *  and not selectable. Blank cells pad before the 1st and after the last day.
 *  Rows share the card body's leftover height (the card never grows taller
 *  than the week view). */
export function CompletionMonth({ weeks, completions, color, today }: Props) {
  const theme = useThemeName()
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="flex h-full min-h-0 w-full max-w-[255px] flex-col justify-center">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 pb-0.5 sm:pb-1 shrink-0" aria-hidden="true">
          {WEEKDAYS.map((wd) => (
            <span key={wd} className="text-[10px] select-none text-center uppercase tracking-wide text-fg-muted">
              {wd}
            </span>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-0.5 sm:gap-1 flex-1 min-h-0"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        >
          {weeks.flatMap((row, r) =>
            row.map((date, col) => {
              const key = `${r}-${col}`
              if (!date) return <span key={key} aria-hidden="true" />
              const isToday = date === today
              const isFuture = date > today
              const c = completions.get(date)
              const pct = c ? intensityPct(c.frac) : 0
              const label = c
                ? `${TITLE_FMT.format(parseLocalDate(date))} — ${c.done} of ${c.eligible} done`
                : `${TITLE_FMT.format(parseLocalDate(date))} — no habits yet`
              const filled = pct > 0
              const bg = isFuture
                ? 'var(--surface-2)'
                : filled
                  ? `color-mix(in srgb, ${color} ${pct}%, transparent)`
                  : 'var(--surface-2)'
              const textColor = isFuture ? 'text-fg-muted' : filled ? readableColor(color, theme) : undefined
              return (
                <div
                  key={key}
                  title={label}
                  aria-label={label}
                  className={`w-full rounded-md sm:rounded-lg border py-0.5 sm:py-1 px-0.5 text-[10px] sm:text-[11px] leading-none text-center select-none flex items-center justify-center ${
                    isFuture ? 'border-border/40' : filled ? 'border-transparent' : 'border-border/40'
                  } ${isToday ? 'ring-1 ring-accent' : ''}`}
                  style={{
                    backgroundColor: bg,
                  }}
                >
                  <span style={textColor ? { color: textColor } : undefined}>
                    {parseLocalDate(date).getDate()}
                  </span>
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
