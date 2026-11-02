import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { readableColor, tint } from '../lib/color'
import { normalizeEmoji } from '../lib/emoji'
import { useThemeName } from '../hooks/useThemeName'
import { IconFlame, IconPencil } from './icons'
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
      className="size-5 text-white"
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
  // Mirrors the CSS container query on .tile-cell (< 232px compacts): in
  // compact tiles only the "more" button fits, so the pencil hides and the
  // menu gains an "Edit habit" item.
  const [compact, setCompact] = useState(false)
  const tileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done) {
      setPopping(true)
      setBursting(true)
    }
  }, [done])

  useEffect(() => {
    const el = tileRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setCompact((e?.contentRect.width ?? el.clientWidth) < 232))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
      ref={tileRef}
      className={`habit-tile group relative flex h-full min-h-[132px] flex-col rounded-tile p-5 ${overlay ? '' : 'fade-up'} ${
        skipped ? 'saturate-50 opacity-80' : ''
      } ${menuOpen && !overlay ? 'z-10' : ''}`}
      style={cssVars({
        // Light theme mixes the habit toward white (pastel); dark keeps the
        // transparent tints. '--tile-glow' feeds the light-only tile shadow.
        '--tile-bg':
          theme === 'light'
            ? `linear-gradient(145deg, color-mix(in srgb, ${c} 20%, white), color-mix(in srgb, ${c} 7%, white))`
            : `linear-gradient(145deg, ${tint(c, 22)}, ${tint(c, 6)})`,
        '--tile-border':
          theme === 'light' ? `color-mix(in srgb, ${c} 35%, white)` : tint(c, 35),
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
          className={`tile-check relative grid size-11 shrink-0 place-items-center rounded-full transition-all duration-150 active:scale-95 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${reorderMode ? 'cursor-grab opacity-60' : ''} ${
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
              className={`tile-emoji text-xl leading-none ${skipped ? 'opacity-70' : ''}`}
            >
              {emoji}
            </span>
          ) : (
            done && <CheckIcon />
          )}
          {done && emoji && (
            <span
              aria-hidden="true"
              className="tile-check-badge absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-white shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-2.5"
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
        <div className="flex shrink-0 items-start">
          <Link
            to={`/habits/${habit.id}/edit`}
            aria-label={`Edit ${habit.name}`}
            title="Edit habit"
            draggable={false}
            tabIndex={reorderMode ? -1 : undefined}
            aria-disabled={reorderMode || undefined}
            className={`tile-edit relative grid size-11 place-items-center rounded-pill text-fg-muted transition-opacity duration-150 hover:bg-surface hover:text-fg focus-visible:opacity-100 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${reorderMode ? 'pointer-events-none opacity-60' : ''} ${
              compact ? 'hidden' : ''
            }`}
          >
            <IconPencil className="size-4" />
          </Link>
          {onSkipToggle && (
            <TileMoreMenu
              habitId={habit.id}
              habitName={habit.name ?? 'habit'}
              dayLabel={dayLabel}
              skipped={skippedRow ?? skipped}
              disabled={reorderMode}
              showEditItem={compact}
              onSkipToggle={onSkipToggle}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
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
        <div className="mt-auto">
          {!skipped && (
            <div className="h-1.5 w-full overflow-hidden rounded-pill bg-fg/10">
              <div
                className="h-full rounded-pill transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: c }}
              />
            </div>
          )}
          {showEditor ? (
            <form onSubmit={submitValue} className="relative mt-1 flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                inputMode="decimal"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label={`Value for ${habit.name}`}
                className="h-11 w-24 min-w-0 rounded-input border border-border bg-surface px-2.5 text-body text-fg focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="h-11 shrink-0 rounded-pill bg-accent-gradient px-3 text-caption text-white transition-all duration-150 hover:brightness-110"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setInput('')
                }}
                className="h-11 shrink-0 rounded-pill border border-border px-3 text-caption text-fg-secondary hover:bg-surface"
              >
                Cancel
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
