import { useEffect, useState, type AnimationEvent, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { readableColor, tint } from '../lib/color'
import { normalizeEmoji } from '../lib/emoji'
import { useThemeName } from '../hooks/useThemeName'
import { IconCheck, IconFlame, IconX } from './icons'
import { TileMoreMenu } from './TileMoreMenu'
import type { Habit } from '../lib/score'

interface Props {
  habit: Habit
  done: boolean
  /** The displayed date is skipped (neutral) — tile is muted with a caption. */
  skipped?: boolean
  /** Caption text for a neutral day: "Skipped" or "Vacation". */
  skippedLabel?: string
  /** Whether a status-'skipped' ROW exists (drives the menu's Skip/Undo-skip
   *  item; a vacation day is neutral without any row). Defaults to `skipped`. */
  skippedRow?: boolean
  streak: number
  /** Entry value at the displayed date (numeric habits); always null when skipped. */
  value: number | null
  /** Label for the skip menu item: "today" or the selected date, short. */
  dayLabel?: string
  /** Tile position, for the staggered fade-up delay. */
  index: number
  onToggle: () => void
  onLogValue: (value: number) => void
  onSkipToggle?: () => void
  /** Reorder (jiggle) mode: check-in/edit/links are disabled and dimmed,
   *  the wiggle runs out of sync via a negative per-tile delay. */
  reorderMode?: boolean
  /** DragOverlay preview: renders mid-drag, so skip the fade-up entry. */
  overlay?: boolean
}

/** Route an object of string keys into React's style prop as CSS variables. */
function cssVars(style: Record<string, string | number | undefined>): CSSProperties {
  return style as unknown as CSSProperties
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

function formatNumber(n: number): string {
  return Number.isFinite(n) ? String(n) : '0'
}

/** Habit tile (DESIGN.md §6): tinted gradient card, 44px check ring with a
 *  pop + burst of habit-colored dots, name (never habit-colored), streak chip,
 *  and for numeric habits a 6px progress bar plus "value / target unit".
 *  A skipped day is neutral: the tile is muted with a "Skipped" caption and
 *  the date can be skipped/undone via the tile's "more" menu. */
export function HabitTile({
  habit,
  done,
  skipped = false,
  skippedLabel = 'Skipped',
  skippedRow,
  streak,
  value,
  dayLabel = 'today',
  index,
  onToggle,
  onLogValue,
  onSkipToggle,
  reorderMode = false,
  overlay = false,
}: Props) {
  const c = habit.color ?? '#3B82F6'
  const emoji = normalizeEmoji(habit.emoji)
  const theme = useThemeName()
  const isNumeric = habit.type === 'numeric'
  const [popping, setPopping] = useState(false)
  const [bursting, setBursting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (done) {
      setPopping(true)
      setBursting(true)
    }
  }, [done])

  function handleAnimationEnd(e: AnimationEvent<HTMLButtonElement>) {
    if (e.animationName === 'ring-pop') setPopping(false)
    if (e.animationName === 'burst-dot') setBursting(false)
  }

  function submitValue(e: FormEvent) {
    e.preventDefault()
    const v = Number(input)
    if (Number.isFinite(v) && v >= 0) onLogValue(v)
    setEditing(false)
    setInput('')
  }

  const unit = habit.unit?.trim() ?? ''
  const pct = value != null ? Math.max(0, Math.min(100, (value / Math.max(1, habit.target)) * 100)) : 0
  const valueLabel = isNumeric
    ? `${formatNumber(value ?? 0)} / ${formatNumber(habit.target)}${unit ? ` ${unit}` : ''}`
    : null
  // The inline editor never opens in reorder mode (checkboxes/inputs are locked).
  const showEditor = isNumeric && editing && !reorderMode
  // Jiggle runs out of sync: negative per-tile delay beats the fade-up's
  // positive stagger (the entry animation is long finished by then).
  const stagger = overlay ? undefined : `${reorderMode ? (index % 6) * -37 : index * 40}ms`

  return (
    <div
      className={`habit-tile group relative flex h-full min-h-[132px] flex-col rounded-tile p-4 ${overlay ? '' : 'fade-up'} ${
        skipped ? 'saturate-50 opacity-80' : ''
      } ${menuOpen && !overlay ? 'z-10' : ''}`}
      style={cssVars({
        // Light palettes mix the habit toward white (pastel); dark palettes keep the
        // transparent tints. '--tile-glow' feeds the light-only tile shadow.
        '--tile-bg':
          theme === 'light' || theme === 'sepia' || theme === 'solarized-light'
            ? `linear-gradient(145deg, color-mix(in srgb, ${c} 20%, white), color-mix(in srgb, ${c} 7%, white))`
            : `linear-gradient(145deg, ${tint(c, 22)}, ${tint(c, 6)})`,
        '--tile-border':
          theme === 'light' || theme === 'sepia' || theme === 'solarized-light'
            ? `color-mix(in srgb, ${c} 35%, white)`
            : tint(c, 35),
        '--tile-border-hover': tint(c, 70),
        '--tile-glow': `color-mix(in srgb, ${c} 55%, transparent)`,
        animationDelay: stagger,
      })}
    >
      {/* Whole tile = link to the habit's overview. Positioned later siblings
          (check, pencil, value button/editor) paint above it; everything else
          clicks through. Disabled in reorder mode. */}
      <Link
        to={`/habits/${habit.id}`}
        tabIndex={reorderMode ? -1 : undefined}
        aria-hidden={reorderMode || undefined}
        className={`absolute inset-0 rounded-tile focus-visible:ring-2 focus-visible:ring-accent focus-visible:[outline:none] ${reorderMode ? 'pointer-events-none' : ''}`}
      >
        <span className="sr-only">View {habit.name} overview</span>
      </Link>
      <div className="flex items-start justify-between">
        {/* 44px circular check: pending = 2px habit ring; done = fill + glow + white check;
            skipped = dashed muted neutral ring (a check-in on a skipped day upserts done).
            A habit emoji is painted inside the ring (tinted while pending) so the tile
            stays identifiable when the name truncates; done adds a small check badge. */}
        <button
          type="button"
          onClick={onToggle}
          disabled={reorderMode}
          aria-pressed={done}
          aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
          onAnimationEnd={handleAnimationEnd}
          className={`tile-check relative grid size-[52px] shrink-0 place-items-center rounded-full transition-all duration-150 active:scale-95 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${reorderMode ? 'cursor-grab opacity-60' : ''} ${
            popping ? 'ring-pop' : ''
          }`}
          style={
            done
              ? { backgroundColor: c, boxShadow: `0 6px 18px -6px ${tint(c, 60)}` }
              : skipped
                ? {
                    border: `2px dashed color-mix(in srgb, ${c} 45%, transparent)`,
                    ...(emoji ? { backgroundColor: `color-mix(in srgb, ${c} 8%, transparent)` } : {}),
                  }
                : {
                    border: `2px solid ${c}`,
                    ...(emoji ? { backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)` } : {}),
                  }
          }
          title={skipped ? `${skippedLabel} — tap to check in` : undefined}
        >
          {emoji ? (
            <span
              aria-hidden="true"
              className={`tile-emoji text-2xl leading-none ${skipped ? 'opacity-70' : ''}`}
            >
              {emoji}
            </span>
          ) : (
            done && <CheckIcon />
          )}
          {done && emoji && (
            <span
              aria-hidden="true"
              className="tile-check-badge absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-white shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-3"
                fill="none"
                stroke={c}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
          )}
          {bursting && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="burst-dot"
                  style={cssVars({ '--angle': `${i * 60 - 90}deg`, '--burst-color': c })}
                />
              ))}
            </span>
          )}
        </button>
        <TileMoreMenu
          habitId={habit.id}
          habitName={habit.name ?? 'habit'}
          dayLabel={dayLabel}
          skipped={skippedRow ?? skipped}
          disabled={reorderMode}
          onSkipToggle={onSkipToggle}
          onOpenChange={setMenuOpen}
        />
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="tile-name text-habit-name min-w-0 flex-1 truncate text-fg">
          {habit.name}
        </span>
        {skipped && (
          <span
            className="shrink-0 text-caption text-fg-muted"
            title={`${skippedLabel} — the day is neutral`}
          >
            {skippedLabel}
          </span>
        )}
        <span
          className="tile-streak inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1"
          title="Current streak"
        >
          <span className="grid place-items-center" style={{ color: readableColor(c, theme) }}>
            <IconFlame className="size-3.5" />
          </span>
          <span className="text-caption tabular-nums">{streak}</span>
        </span>
      </div>

      {isNumeric && (
        <div className="mt-auto flex w-full min-w-0 flex-col">
          {!skipped && (
            <div className="h-1.5 w-full overflow-hidden rounded-pill bg-fg/10">
              <div
                className="h-full rounded-pill transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: c }}
              />
            </div>
          )}
          {showEditor ? (
            <form
              onSubmit={submitValue}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(false)
                  setInput('')
                }
              }}
              className="relative z-20 mt-1 flex w-full min-w-0 items-center gap-1.5"
            >
              <input
                autoFocus
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-label={`Value for ${habit.name}`}
                className="h-9 flex-1 min-w-0 rounded-input border border-border bg-surface px-1.5 text-center text-[15px] tabular-nums text-fg focus:border-accent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
              />
              <button
                type="submit"
                aria-label="Save value"
                title="Save value"
                className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-success/35 bg-success/15 text-success transition-colors hover:bg-success/25 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
              >
                <IconCheck className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setInput('')
                }}
                aria-label="Cancel"
                title="Cancel"
                className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-danger/35 bg-danger/15 text-danger transition-colors hover:bg-danger/25 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
              >
                <IconX className="size-[18px]" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (skipped) return
                setInput(value != null ? String(value) : '')
                setEditing(true)
              }}
              aria-label={skipped ? `Value for ${habit.name} (${skippedLabel.toLowerCase()})` : `Log value for ${habit.name}`}
              tabIndex={reorderMode ? -1 : undefined}
              aria-disabled={reorderMode || undefined}
              className={`tile-value relative text-body tabular-nums -ml-1 mt-1 flex min-h-11 items-center rounded-pill px-1 text-fg-secondary duration-150 hover:bg-surface ${reorderMode ? 'pointer-events-none opacity-60' : ''} ${
                skipped ? 'cursor-default' : ''
              }`}
            >
              {skipped ? <span className="text-fg-muted">{skippedLabel}</span> : valueLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
