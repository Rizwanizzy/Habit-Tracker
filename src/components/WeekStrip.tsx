import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { weekStripLabel, type WeekStripCell } from '../lib/weekStrip'
import { IconMoon } from './icons'

/** Stage 1A of UI 2.0 — the Today page's interactive seven-day (Mon–Sun)
 *  week strip. Thin renderer over the pure `buildWeekStrip` cells (whose
 *  indicators reuse the approved `todayPair` metric — see src/lib/weekStrip.ts).
 *
 *  - Clicking an eligible (non-future) day calls `onSelect(date)`, which
 *    updates the SAME `selectedDate` state as the existing chevrons/date
 *    pill — no duplicate navigation, the strip just complements them.
 *  - Future days are disabled placeholders (no completion values shown).
 *  - Selected day: surface-raised pill + accent ring. Logical today: accent
 *    weekday letter + `aria-current="date"`. Paused (vacation): moon badge +
 *    dimmed. Neutral (nothing scheduled / all skipped): dimmed. All states
 *    use design tokens only, so every theme (incl. High Contrast, Sepia,
 *    OLED, Solarized) restyles them automatically.
 *  - Keyboard: one tab stop (roving tabindex on the selected day) with
 *    Left/Right/Home/End moving focus between enabled days; Enter/Space
 *    select natively. Focus ring is an explicit visible outline; transitions
 *    are token-based and killed globally under reduced motion. */

interface Props {
  cells: WeekStripCell[]
  onSelect: (date: string) => void
}

/** Circumference of the indicator ring (r = 15.5 in the 36×36 viewBox). */
const CIRC = 2 * Math.PI * 15.5

export function WeekStrip({ cells, onSelect }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIdx = cells.findIndex((c) => c.selected && !c.future)
  const firstEnabled = cells.findIndex((c) => !c.future)
  const rovingIdx = selectedIdx !== -1 ? selectedIdx : firstEnabled

  const moveFocus = (from: number, step: 1 | -1) => {
    let i = from + step
    while (i >= 0 && i < cells.length) {
      if (!cells[i].future) {
        refs.current[i]?.focus()
        return
      }
      i += step
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveFocus(index, -1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveFocus(index, 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      moveFocus(-1, 1)
    } else if (e.key === 'End') {
      e.preventDefault()
      moveFocus(cells.length, -1)
    }
  }

  return (
    <div
      role="group"
      aria-label="This week's days"
      className="grid w-full grid-cols-7 gap-1 sm:gap-1.5"
    >
      {cells.map((cell, i) => {
        const disabled = cell.future
        const dimmed = cell.future || cell.paused || cell.neutral
        return (
          <button
            key={cell.date}
            type="button"
            ref={(el) => {
              refs.current[i] = el
            }}
            disabled={disabled}
            tabIndex={i === rovingIdx ? 0 : -1}
            aria-current={cell.isToday ? 'date' : undefined}
            aria-label={`${weekStripLabel(cell)}${cell.isToday ? ', today' : ''}${cell.selected ? ', selected' : ''}`}
            onClick={() => onSelect(cell.date)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={cell.selected ? { border: 'none' } : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-0 py-1.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              cell.selected ? 'bg-surface-raised ring-1 ring-accent' : dimmed ? '' : 'hover:bg-surface-raised/60'
            } ${dimmed ? 'opacity-55' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`text-[10px] font-medium leading-none ${
                cell.isToday && !cell.selected ? 'font-bold text-accent' : 'text-fg-muted'
              }`}
            >
              {cell.weekday}
            </span>
            <span className="relative grid size-9 place-items-center" aria-hidden="true">
              <svg viewBox="0 0 36 36" className="absolute inset-0 size-full">
                <circle
                  cx={18}
                  cy={18}
                  r={15.5}
                  fill="none"
                  strokeWidth={2.5}
                  className="stroke-border"
                  opacity={cell.future ? 0.5 : 1}
                />
                {!cell.future && cell.fraction > 0 && (
                  <circle
                    cx={18}
                    cy={18}
                    r={15.5}
                    fill="none"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={`${(CIRC * cell.fraction).toFixed(3)} ${CIRC.toFixed(3)}`}
                    transform="rotate(-90 18 18)"
                    className="stroke-accent"
                  />
                )}
              </svg>
              <span
                className={`text-[13px] font-semibold leading-none tabular-nums ${
                  dimmed ? 'text-fg-muted' : 'text-fg'
                }`}
              >
                {cell.dayNumber}
              </span>
              {cell.paused && <IconMoon className="absolute -top-1 right-0 size-3 text-fg-muted" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
