import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useThemeName } from '../hooks/useThemeName'
import { readableColor } from '../lib/color'
import { moveHabit } from '../lib/order'
import {
  clampMatrixNameLevel,
  matrixCaption,
  matrixCellAction,
  matrixCellLabel,
  matrixCellMenuAction,
  matrixDateLabel,
  matrixNameKeyAction,
  matrixNamePaneStyle,
  numericCellDisplayValue,
  numericCellProgress,
  revealColumnScroll,
  type HabitMatrixData,
  type MatrixCell,
  type MatrixCellAction,
  type MatrixCellState,
} from '../lib/habitMatrix'
import type { Habit } from '../lib/score'
import { IconCheck, IconGrip, IconMoon, IconSkip } from './icons'
import { MatrixCellMenu, type MatrixCellMenuAnchor } from './MatrixCellMenu'

/** UI 2.0 Stage 2 (final refinement) — INTERACTIVE weekly habit matrix:
 *  habit rows in user order × seven Monday–Sunday columns for the selected
 *  date's week. Pure data comes from lib/habitMatrix.ts (dayStatus + schedule
 *  history — no competing logic); cell actions come from matrixCellAction and
 *  are wired to the EXISTING Today check-in pipeline (toggle / logValue /
 *  skip, parameterized by cell date) — same optimistic updates, rollback and
 *  entry semantics as the Tiles. No separate persistence path exists here.
 *
 *  Interaction rules (see lib/habitMatrix.ts): boolean done↔pending toggle
 *  (repeated click undoes), numeric cells open the inline value editor
 *  (never auto-completed), skipped cells undo the skip, vacation /
 *  unscheduled / before-start / future cells stay read-only. A 500ms
 *  long-press (touch) or right-click (mouse) on a pending/skipped chip opens
 *  the compact MatrixCellMenu (Skip this day / Remove skip / Cancel) — a
 *  body portal, so it never grows a row or the scroller. The habit-name row
 *  is `[six-dot handle] [emoji] [name]`: the name cell stays a link to the
 *  same Habit Detail route the Today tiles use (one accessible target per
 *  row), while the handle is the only drag surface for vertical row
 *  reordering (no wiggle mode); date cells never navigate.
 *
 *  Visuals (Aurora Glass): habit-colored rounded-square chips — done = solid
 *  habit color + readable check; pending = subtle habit tint + hairline ring
 *  (weekly unchecked days are NOT grey "missed" blocks); skipped = dashed
 *  habit tint; the rest stay token-based so all themes keep contrast.
 *  NUMERIC cells add a bottom-to-top habit-color fill (value/target,
 *  clamped 0–100 by numericCellProgress) with the value/target label as a
 *  CENTERED foreground overlay — 9px semibold tabular-nums in the theme
 *  high-contrast foreground (never the habit color) with a soft bg-base
 *  halo for readability over tint/fill in every theme; it shows at 0%,
 *  partial, completion ("9/9" instead of only a checkmark) and over-target
 *  ("12/9"); when it fits it takes the chip's center from the check/dot
 *  glyph, and long values ("100/100") fall back to the exact tooltip/aria
 *  description with the glyph kept. Untouched pending cells DISPLAY
 *  "0/target" (numericCellDisplayValue) exactly like a recorded zero —
 *  display-only: no entry is created and the editor still prefills empty.
 *  Layout (visual-integration fix, investigated across four paint attempts):
 *  TWO PANES — a fixed habit-name pane beside a horizontally scrolling
 *  date-columns table. The names pane paints NOTHING (the glass card shows
 *  through, identical to the date columns — no sidebar effect possible) and
 *  sits OUTSIDE the scroller, so scrolled cells and their numeric labels
 *  structurally cannot reach it — no sticky backing, no occlusion layer, no
 *  bleed-through, and no guessed colors anywhere. A hairline right border
 *  divides the panes; locked row heights keep the row dividers aligned.
 *  Every cell keeps its isolation:isolate stacking context (chip layers stay
 *  atomic), and the selected-column auto-reveal counts the pane's width as
 *  the sticky-zone obstruction (same revealColumnScroll math, untouched).
 *  Selected date = 8% accent tint per column cell only (no large overlay);
 *  today's header is accent + aria-current="date"; the selected column is
 *  auto-revealed on selection change/matrix mount via revealColumnScroll
 *  (minimum distance, sticky-aware, smooth unless reduced motion).
 *  Table semantics preserved: caption, scope headers, per-cell labels. */

interface Props {
  data: HabitMatrixData
  /** Existing Today handlers, parameterized by cell date (Tiles pass the
   *  selectedDate default — unchanged). */
  onToggle: (habit: Habit, date: string) => void
  onLogValue: (habit: Habit, value: number, date: string) => void
  /** Existing skip toggle (Today picks skip vs remove-skip from the stored
   *  row) — used by the long-press/right-click popup and normal taps on a
   *  skipped cell. */
  onSkip: (habit: Habit, date: string) => void
  /** Habit-name pane width level (1–4, clamped). Level 1 is the production
   *  pane exactly; each step adds one date-column width. Owned/persisted by
   *  the Today page (shared "Habit names" pill). */
  nameWidth: number
  /** FULL ordered active habit list (not the filtered rows). Drag-and-drop
   *  reorders against this list so habits hidden by the Scheduled filter keep
   *  their relative positions — exactly like the Tiles grid. Optional for
   *  static markup tests; falls back to the rendered rows. */
  habits?: Habit[]
  /** Persists the new order through the shared reorderHabits mechanism
   *  (optimistic save + rollback). Omit to disable saving. */
  onReorder?: (orderedIds: string[]) => Promise<void>
  /** Shared toast channel ("Order saved"); failures arrive via reorderError. */
  onNotice?: (kind: 'success' | 'danger', text: string) => void
}

interface Editing {
  habitId: string
  date: string
}

const CHIP =
  'mx-auto grid size-8 place-items-center rounded-[10px] transition-colors duration-150'

function chipClass(state: MatrixCellState): string {
  switch (state) {
    case 'done':
    case 'pending':
    case 'skipped':
      return CHIP
    case 'unscheduled':
      return `${CHIP} bg-fg/5`
    case 'vacation':
      return `${CHIP} bg-surface-raised`
    case 'future':
      return `${CHIP} bg-fg/[0.04] opacity-60`
    case 'before-start':
      return `${CHIP} border border-fg/10 bg-fg/[0.03] opacity-40`
  }
}

/** Habit-colored treatments for done / pending / skipped (inline, like the
 *  tiles' color-mix recipes); every other state stays token-based. */
function chipStyle(state: MatrixCellState, c: string, theme: ReturnType<typeof useThemeName>): CSSProperties | undefined {
  switch (state) {
    case 'done':
      return {
        backgroundColor: c,
        color: readableColor(c, theme),
        boxShadow: `0 4px 12px -6px color-mix(in srgb, ${c} 70%, transparent)`,
      }
    case 'pending':
      // currentColor = habit color: paints the partial-progress dot; the
      // value/target label overrides its own color explicitly.
      return {
        border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)`,
        color: c,
      }
    case 'skipped':
      return {
        border: `1px dashed color-mix(in srgb, ${c} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${c} 8%, transparent)`,
      }
    default:
      return undefined
  }
}

/** Center glyph per state. `hideGlyph` is set when the centered numeric
 *  value/target label takes the chip's center instead (they would overlap):
 *  done numerics then show the exact value ("9/9", "12/9") rather than a
 *  checkmark, while long values ("100/100" — label omitted) keep the check.
 *  Booleans never pass hideGlyph. */
function cellGlyph(cell: MatrixCell, hideGlyph = false) {
  switch (cell.state) {
    case 'done':
      return hideGlyph ? null : <IconCheck className="size-4" />
    case 'skipped':
      return <IconSkip className="size-3.5 text-fg-muted" />
    case 'vacation':
      return <IconMoon className="size-3.5 text-fg-muted" />
    case 'unscheduled':
      return <span className="text-[11px] leading-none text-fg-muted">–</span>
    case 'pending':
      // Numeric partial progress: a small habit-colored dot, used only when
      // the compact value/target label cannot be shown (long values).
      return cell.value != null && cell.value > 0 && !hideGlyph ? (
        <span className="size-1.5 rounded-full bg-current opacity-70" />
      ) : null
    default:
      return null
  }
}

/** Screen-reader / tooltip text: habit name first (the matrix renders the
 *  names pane and the date columns as two tables, so every cell must stay
 *  self-describing for screen readers), then the state description, an
 *  action hint when the cell is interactive, and the numeric display value
 *  when one exists — including the 0/target display fallback for untouched
 *  pending cells, so the accessible text always matches what is rendered. */
function cellAriaLabel(cell: MatrixCell, habit: Habit): string {
  const action: MatrixCellAction | null = matrixCellAction(cell, habit)
  const base = `${habit.name} — ${matrixCellLabel(cell)}`
  const dv = habit.type === 'numeric' ? numericCellDisplayValue(cell) : undefined
  const numeric =
    dv != null
      ? ` (${formatNumber(dv)} / ${formatNumber(habit.target)}${habit.unit ? ` ${habit.unit.trim()}` : ''})`
      : ''
  if (!action) return `${base}${numeric}`
  switch (action) {
    case 'toggle':
      return cell.state === 'done' ? `${base}${numeric} — tap to undo` : `${base} — tap to check in`
    case 'edit-value':
      return `${base}${numeric} — tap to edit value`
    case 'unskip':
      return `${base} — tap to remove skip`
  }
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** One sortable habit row in the fixed names pane (Task 2). The first column
 *  is now `[six-dot handle] [emoji / colour dot] [name]` at a consistent
 *  optical size (handle 18px glyph in a 32×40px hit area, emoji 22px box /
 *  14px glyph, name 14px) while the CSS-locked 40px row height, truncation
 *  and name-width levels stay exactly as before.
 *
 *  Drag activation lives ONLY on the handle (`useSortable` listeners +
 *  keyboard attributes): a normal tap on the name/emoji still follows the
 *  full-cell Link to Habit Detail, and the date cells stay untouched. Mouse
 *  starts a drag after 5px; touch requires a 350ms long-press with 8px
 *  tolerance (no wiggle mode); Space/Enter on the focused handle starts
 *  keyboard reordering (arrows move, Space drops, Escape cancels). The row
 *  transform is pure transform (no layout change), and on drop Today's
 *  optimistic `reorderHabits` reorders the shared habits so BOTH panes (and
 *  the Tiles view) render the same order. */
function MatrixNameRow({ habit }: { habit: Habit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })
  const name = habit.name ?? 'habit'

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 2 } : null),
      }}
    >
      <th scope="row" className="relative p-1.5 pr-2 text-left align-middle font-normal">
        <span className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}`}
            title="Drag to reorder"
            className="relative z-10 -ml-1 grid h-7 w-6 shrink-0 cursor-grab place-items-center rounded-[6px] text-fg-muted transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:cursor-grabbing after:absolute after:-inset-y-1.5 after:-left-1 after:-right-1 after:content-['']"
          >
            <IconGrip className="size-[18px]" />
          </button>
          {habit.emoji ? (
            <span
              aria-hidden="true"
              className="grid size-[22px] shrink-0 place-items-center text-[14px] leading-none"
            >
              {habit.emoji}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="size-[15px] shrink-0 rounded-[5px]"
              style={{ backgroundColor: habit.color, opacity: 0.9 }}
            />
          )}
          <span className="truncate text-[14px] font-semibold text-fg" title={name}>
            {name}
          </span>
        </span>
        {/* Whole name cell = link to Habit Detail (unchanged contract). The
            handle above is z-10 and wins the pointer; everywhere else the
            transparent overlay captures the tap. */}
        <Link
          to={`/habits/${habit.id}`}
          title={name}
          aria-label={`View ${name} overview`}
          onKeyDown={(e) => {
            if (matrixNameKeyAction(e.key) !== 'space') return
            e.preventDefault()
            e.currentTarget.click()
          }}
          className="absolute inset-0 rounded-[6px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        />
      </th>
    </tr>
  )
}

export function HabitMatrix({ data, onToggle, onLogValue, onSkip, nameWidth, habits, onReorder, onNotice }: Props) {
  const theme = useThemeName()
  const { dates, rows } = data
  const [editing, setEditing] = useState<Editing | null>(null)
  // Clamped here too so a bad stored value can never reach the pane style.
  const nameLevel = clampMatrixNameLevel(nameWidth)

  // Row reordering (Task 2): the names pane is the sortable surface.
  // Mouse needs a 5px move (a plain tap on the handle does nothing and never
  // navigates); touch requires a 350ms long-press so vertical page scrolling
  // is never hijacked; keyboard uses dnd-kit's sortable coordinates on the
  // focused handle. `orderSource` is the FULL ordered active list, so hidden
  // (Scheduled-filtered) habits keep their relative order — same as Tiles.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const orderSource = habits ?? rows.map((r) => r.habit)

  // Screen-reader announcements use habit NAMES, not raw ids (dnd-kit's
  // defaults announce "Draggable item h3").
  const announcements = useMemo<Announcements>(() => {
    const nameById = new Map(rows.map(({ habit }) => [habit.id, habit.name ?? 'habit']))
    const nameOf = (id: unknown) => nameById.get(String(id)) ?? 'habit'
    return {
      onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over ? `${nameOf(active.id)} moved over ${nameOf(over.id)}.` : undefined,
      onDragEnd: ({ active, over }) =>
        over ? `${nameOf(active.id)} dropped on ${nameOf(over.id)}.` : `${nameOf(active.id)} dropped.`,
      onDragCancel: ({ active }) => `Reordering ${nameOf(active.id)} cancelled.`,
    }
  }, [rows])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const nextIds = moveHabit(orderSource, String(active.id), String(over.id)).map((h) => h.id)
    await onReorder(nextIds)
    onNotice?.('success', 'Order saved')
  }

  // Selected-date auto-reveal (Stage 2 final refinement): whenever the
  // selected date changes (date picker, week strip, chevrons), the matrix
  // first mounts (Tiles→Matrix switch) or the name-pane WIDTH changes,
  // bring the selected column fully into view — counting the fixed
  // habit-name PANE (which sits outside the scroller and occupies the
  // viewport's left edge) as obstruction. The helper returns null when the
  // column is already visible, so a width change that keeps it in view
  // never resets the user's manual horizontal scroll. Keyed ONLY on the
  // selected date and the width level: check-ins/habit edits re-render the
  // matrix but never scroll it. Smooth by default, instant under
  // prefers-reduced-motion.
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const selectedColRef = useRef<HTMLTableCellElement>(null)
  const selectedCellDate = rows[0]?.cells.find((c) => c.selected)?.date ?? null

  useEffect(() => {
    const container = scrollRef.current
    const column = selectedColRef.current
    const sticky = stickyRef.current
    if (!container || !column || !sticky) return
    const containerRect = container.getBoundingClientRect()
    const columnRect = column.getBoundingClientRect()
    const target = revealColumnScroll({
      scrollLeft: container.scrollLeft,
      clientWidth: container.clientWidth,
      scrollWidth: container.scrollWidth,
      stickyWidth: sticky.offsetWidth,
      columnLeft: columnRect.left - containerRect.left + container.scrollLeft,
      columnWidth: columnRect.width,
    })
    if (target == null) return
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' })
  }, [selectedCellDate, nameLevel])

  if (rows.length === 0) {
    return (
      <section className="glass-card fade-up rounded-card px-4 py-8 text-center" style={{ animationDelay: '60ms' }}>
        <p className="text-body text-fg-secondary">No habits to show for this week in this view.</p>
      </section>
    )
  }

  return (
    <section className="glass-card fade-up rounded-card p-3 sm:p-4 lg:p-5" style={{ animationDelay: '60ms' }} aria-label="Weekly habit matrix">
      {/* TWO-PANE layout (visual-integration fix): the habit-name pane paints
          NOTHING and sits directly on the glass card exactly like the date
          columns — visual continuity by construction, no sidebar effect — and
          lives OUTSIDE the horizontal scroller, so scrolled date cells and
          their numeric labels can structurally never reach it (no sticky
          backing, no occlusion layer, no bleed-through possible). The pane's
          width feeds revealColumnScroll as the sticky-zone width. Locked row
          heights (.matrix-table tr rule in index.css) keep the row dividers
          of both panes aligned; the divider is a hairline right border. */}
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
      <div className="flex items-stretch">
        <div
          ref={stickyRef}
          className="matrix-names w-[30%] min-w-[8.75rem] shrink-0"
          style={matrixNamePaneStyle(nameLevel)}
        >
          <table className="matrix-table w-full table-fixed border-separate border-spacing-0">
            <caption className="sr-only">Habit names</caption>
            <thead>
              <tr>
                {/* "Habits" header — same top line as the weekday row: the th
                    mirrors the dates pane's header padding/alignment and the
                    spacer keeps the single text line in the weekday slot, so
                    the two panes' headers stay vertically aligned. The locked
                    40px header row height is unchanged (card height intact). */}
                <th scope="col" className="p-1 pb-2 pr-3 text-left align-bottom">
                  <span className="block text-[10px] font-medium uppercase leading-none tracking-wide text-fg-muted">
                    Habits
                  </span>
                  <span aria-hidden="true" className="mt-1 block h-3" />
                </th>
              </tr>
            </thead>
            <SortableContext
              items={rows.map(({ habit }) => habit.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {rows.map(({ habit }) => (
                  <MatrixNameRow key={habit.id} habit={habit} />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <table className="matrix-table w-full min-w-[300px] table-fixed border-separate border-spacing-0">
            <caption className="sr-only">{matrixCaption(dates)}</caption>
            <thead>
              <tr>
                {dates.map((date, i) => {
                  const proto = rows[0]?.cells[i]
                  const isToday = proto?.isToday
                  const isSelected = proto?.selected
                  return (
                    <th
                      key={date}
                      ref={isSelected ? selectedColRef : undefined}
                      scope="col"
                      aria-current={isToday ? 'date' : undefined}
                      className={`p-1 pb-2 text-center align-bottom ${isSelected ? 'bg-accent/[0.08]' : ''}`}
                    >
                      <span className="sr-only">{`${matrixDateLabel(date)}${isToday ? ', today' : ''}`}</span>
                      <span aria-hidden="true" className="block">
                        <span
                          className={`block text-[10px] font-medium uppercase leading-none tracking-wide ${
                            isToday ? 'font-bold text-accent' : 'text-fg-muted'
                          }`}
                        >
                          {proto?.weekday}
                        </span>
                        <span
                          className={`mt-1 block text-[12px] font-semibold leading-none tabular-nums ${
                            isToday || isSelected ? 'text-accent' : 'text-fg'
                          }`}
                        >
                          {proto?.dayNumber}
                        </span>
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ habit, cells }) => (
                <tr key={habit.id}>
                  {cells.map((cell) => (
                    <MatrixCellView
                      key={cell.date}
                      cell={cell}
                      habit={habit}
                      theme={theme}
                      editing={editing?.habitId === habit.id && editing.date === cell.date}
                      onToggle={onToggle}
                      onLogValue={onLogValue}
                      onSkip={onSkip}
                      onEdit={() => setEditing({ habitId: habit.id, date: cell.date })}
                      onCloseEditor={() => setEditing(null)}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </DndContext>
    </section>
  )
}

function MatrixCellView({
  cell,
  habit,
  theme,
  editing,
  onToggle,
  onLogValue,
  onSkip,
  onEdit,
  onCloseEditor,
}: {
  cell: MatrixCell
  habit: Habit
  theme: ReturnType<typeof useThemeName>
  editing: boolean
  onToggle: Props['onToggle']
  onLogValue: Props['onLogValue']
  onSkip: Props['onSkip']
  onEdit: () => void
  onCloseEditor: () => void
}) {
  const c = habit.color ?? '#3B82F6'
  const action = matrixCellAction(cell, habit)
  const label = cellAriaLabel(cell, habit)
  const cellRef = useRef<HTMLButtonElement>(null)
  // Long-press / right-click skip popup (Task 1). Anchor is the chip's
  // viewport rect; the menu itself is portalled (MatrixCellMenu) so it can
  // never affect the table's layout or the horizontal scroller.
  const menuAction = matrixCellMenuAction(cell)
  const [menuAnchor, setMenuAnchor] = useState<MatrixCellMenuAnchor | null>(null)
  const pressTimer = useRef<number | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  /** Eats the trailing click after a long-press opened the popup. */
  const swallowClick = useRef(false)

  useEffect(
    () => () => {
      if (pressTimer.current != null) window.clearTimeout(pressTimer.current)
    },
    [],
  )

  function clearPress() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressOrigin.current = null
  }

  function openMenu() {
    const rect = cellRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
  }

  function closeMenu(restoreFocus: boolean, swallowNextClick = false) {
    setMenuAnchor(null)
    // A dismissing outside press may be followed by a click on the chip;
    // eat it so the tap only closes the popup. The next pointerdown on a
    // cell clears this again, so no later tap is affected.
    if (swallowNextClick) swallowClick.current = true
    if (restoreFocus) setTimeout(() => cellRef.current?.focus(), 0)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // A new press starts a fresh interaction; any trailing click from the
    // previous menu interaction has already been delivered.
    swallowClick.current = false
    // Only the primary button on a skippable cell; a done / read-only cell
    // keeps its normal tap behaviour and gets no popup.
    if (!menuAction || e.button !== 0) return
    pressOrigin.current = { x: e.clientX, y: e.clientY }
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      pressOrigin.current = null
      swallowClick.current = true
      openMenu()
    }, 500)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const o = pressOrigin.current
    if (!o) return
    // Anything beyond the slop is a scroll / tap-drag, not a long-press.
    if (Math.abs(e.clientX - o.x) > 10 || Math.abs(e.clientY - o.y) > 10) clearPress()
  }

  function handleClick() {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    if (action === 'toggle') onToggle(habit, cell.date)
    else if (action === 'unskip') onSkip(habit, cell.date)
    else if (action === 'edit-value') onEdit()
  }

  function handleContextMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (!menuAction) return
    // Suppress the browser menu (and a mobile long-press context menu) only
    // where the app has an action to offer.
    e.preventDefault()
    openMenu()
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    // Keyboard parity for the pointer-only popup: the ContextMenu key or
    // Shift+F10 opens it; Enter/Space keep their normal cell behaviour.
    if (!menuAction) return
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      openMenu()
    }
  }

  // Numeric progress (Stage 2 final refinements): numeric cells render a
  // bottom-to-top habit-color fill (value/target, clamped 0–100) with the
  // value/target label as a centered foreground overlay. The DISPLAY value
  // falls back to 0 for untouched pending cells (numericCellDisplayValue) so
  // they read "0/10" exactly like a recorded zero — pure display, the editor
  // still prefills from the stored cell.value and no entry is written. When
  // the label can be shown it IS the cell's center content — the check/dot
  // glyph yields (they would overlap); booleans and every other state are
  // unchanged.
  const displayValue = habit.type === 'numeric' ? numericCellDisplayValue(cell) : undefined
  const numeric = displayValue != null ? numericCellProgress(displayValue, habit.target) : null
  const showFill = numeric != null && numeric.pct > 0
  const showLabel = numeric?.label != null
  const glyph = cellGlyph(cell, showLabel)

  // Escape cancels editing without saving. Close the editor first, then restore
  // focus to the originating matrix cell so a keyboard user does not lose their
  // place in the grid. setTimeout defers the focus until after React has
  // re-mounted the cell button; focus() on an already-visible cell does not
  // scroll the document.
  const handleCancel = () => {
    onCloseEditor()
    setTimeout(() => cellRef.current?.focus(), 0)
  }

  if (editing) {
    return (
      <td className={`p-1 text-center ${cell.selected ? 'bg-accent/[0.08]' : ''}`}>
        <ValueEditor
          habit={habit}
          cell={cell}
          onCommit={(v) => {
            onLogValue(habit, v, cell.date)
            onCloseEditor()
          }}
          onCancel={handleCancel}
        />
      </td>
    )
  }

  const chip = (
    <>
      {showFill && numeric && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${numeric.pct}%`, backgroundColor: c }}
        />
      )}
      <span aria-hidden="true" className="relative z-10 grid place-items-center">
        {glyph}
      </span>
      {showLabel && numeric && (
        <span
          aria-hidden="true"
          className="absolute inset-0 z-20 grid place-items-center text-center text-[9px] font-semibold leading-none tabular-nums text-fg"
          style={{
            // Theme-aware high-contrast foreground (not the habit color); a
            // soft bg-base halo keeps it readable over both the bare tint and
            // any habit-colored fill, in every theme.
            textShadow: '0 1px 2px var(--bg-base), 0 0 3px var(--bg-base)',
          }}
        >
          {numeric.label}
        </span>
      )}
    </>
  )
  const numericLayer = numeric ? 'relative overflow-hidden' : ''

  return (
    <td className={`p-1 text-center ${cell.selected ? 'bg-accent/[0.08]' : ''}`}>
      {action ? (
        <button
          ref={cellRef}
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearPress}
          onPointerCancel={clearPress}
          onPointerLeave={clearPress}
          onContextMenu={handleContextMenu}
          onKeyDown={handleCellKeyDown}
          aria-pressed={action === 'toggle' ? cell.state === 'done' : undefined}
          aria-haspopup={menuAction ? 'menu' : undefined}
          aria-label={label}
          title={label}
          className={`${chipClass(cell.state)} ${numericLayer} cursor-pointer active:scale-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
          style={chipStyle(cell.state, c, theme)}
        >
          {chip}
        </button>
      ) : (
        <span
          role="img"
          aria-label={label}
          title={label}
          className={`${chipClass(cell.state)} ${numericLayer}`}
          style={chipStyle(cell.state, c, theme)}
        >
          {chip}
        </span>
      )}
      {menuAnchor && menuAction && (
        <MatrixCellMenu
          anchor={menuAnchor}
          habitName={habit.name ?? 'Habit'}
          dateLabel={matrixDateLabel(cell.date)}
          action={menuAction}
          onAction={() => {
            onSkip(habit, cell.date)
            closeMenu(true)
          }}
          onClose={closeMenu}
        />
      )}
    </td>
  )
}

/** Inline numeric value editor — the matrix counterpart of the tile's inline
 *  editor, feeding the SAME onLogValue handler. Prefilled with the cell's
 *  current value; Enter or blur commits (empty input commits nothing —
 *  explicit 0 is the app's "zero progress" semantics), Escape cancels. */
function ValueEditor({
  habit,
  cell,
  onCommit,
  onCancel,
}: {
  habit: Habit
  cell: MatrixCell
  onCommit: (value: number) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(cell.value != null ? String(cell.value) : '')
  const unit = habit.unit?.trim() ?? ''

  function submit() {
    const v = Number(text)
    if (text.trim() !== '' && Number.isFinite(v) && v >= 0) onCommit(v)
    else onCancel()
  }

  return (
    <input
      autoFocus
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      aria-label={`${habit.name} value for ${matrixDateLabel(cell.date)}${unit ? ` (${unit})` : ''}`}
      className="h-8 w-10 rounded-[10px] border border-accent bg-[var(--surface-solid)] px-0.5 text-center text-[12px] tabular-nums text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent input-no-zoom"
    />
  )
}
