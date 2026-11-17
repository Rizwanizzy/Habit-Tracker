import { addDays, parseLocalDate } from './dates'
import { weekStart, shouldShowHabitOnDate, type ScheduleEpoch } from './schedule'
import { dayStatus } from './dayStatus'
import type { Entry, Habit } from './score'

/** UI 2.0 Stage 2 (refined) — the weekly habit matrix, now interactive.
 *  Pure builder: one row per habit (user-defined order), seven columns for
 *  the Monday–Sunday week containing the selected date (same week anchor as
 *  the Stage 1A week strip — `weekStart` from schedule.ts).
 *
 *  Cell states come from the ONE source of truth, `dayStatus` (plus the
 *  existing shouldShowHabitOnDate visibility rule for Scheduled filtering) —
 *  no competing schedule logic:
 *  - 'done'     check-in that day (done wins everywhere, incl. vacations)
 *  - 'pending'  dayStatus 'missed' — deliberately NOT labelled "missed":
 *               for weekly-target habits an unchecked weekday is not a
 *               missed daily obligation, it is simply a day without a
 *               check-in (the weekly goal lives in the tile/hero captions)
 *  - 'skipped'  neutral skip (skipped beats vacation, per dayStatus)
 *  - 'vacation' vacation day with no check-in
 *  - 'unscheduled' off-day / weekly transition week
 *  - 'future'   date > logical today — placeholders only, NEVER completion
 *               values (cells are built without consulting entries)
 *  - 'before-start' before the habit's created_at date
 *
 *  INTERACTION (refinement): eligible cells expose an action via
 *  `matrixCellAction` — the renderer wires it to the EXISTING Today
 *  check-in pipeline (toggle / logValue / skip, same optimistic apply +
 *  rollback). Rules mirror what the app already permits:
 *  - done cells toggle off (undo) — repeated click undoes, incl. a
 *    check-in that was made on a vacation day;
 *  - pending boolean cells check in; pending NUMERIC cells open the value
 *    editor instead (numeric habits are never auto-completed);
 *  - skipped cells undo the skip (remove the neutral row);
 *  - vacation (no entry), unscheduled, before-start and future cells are
 *    NOT interactive — paused/off days stay read-only in the matrix
 *    (Tiles still permit vacation-day check-ins for those who want them).
 *
 *  Scheduled filtering is WEEK-based (a habit is eligible if it is visible
 *  on at least one PAST-or-today date of the displayed week), evaluated
 *  as-of-each-day (today bound = the cell date) so later check-ins can never
 *  leak backwards into historical eligibility. */

export type MatrixCellState =
  | 'done'
  | 'pending'
  | 'skipped'
  | 'unscheduled'
  | 'vacation'
  | 'future'
  | 'before-start'

export interface MatrixCell {
  date: string
  /** Fixed weekday abbreviation (index-derived — deterministic, testable). */
  weekday: string
  dayNumber: number
  state: MatrixCellState
  /** The column of the currently selected date. */
  selected: boolean
  /** The column of the logical today. */
  isToday: boolean
  /** Done-row value for numeric habits (prefills the value editor); pending
   *  cells with a below-target entry carry the partial value. Never set for
   *  skipped rows (value 0 is storage-only), future cells, or pending cells
   *  without an entry — the "0/target" chip text for those is a DISPLAY
   *  fallback (numericCellDisplayValue), never a stored value. */
  value?: number
}

/** What a cell's click does — wired to the EXISTING Today handlers
 *  (toggle / logValue / skip), never a separate persistence path. */
export type MatrixCellAction = 'toggle' | 'edit-value' | 'unskip'

export function matrixCellAction(cell: MatrixCell, habit: Habit): MatrixCellAction | null {
  switch (cell.state) {
    case 'done':
      // Boolean: repeated click undoes the check-in. Numeric: never
      // auto-complete/erase — editing the value is the only action.
      return habit.type === 'numeric' ? 'edit-value' : 'toggle'
    case 'pending':
      return habit.type === 'numeric' ? 'edit-value' : 'toggle'
    case 'skipped':
      return 'unskip'
    // Vacation (without a done entry), unscheduled, before-start and future
    // days stay read-only in the matrix.
    default:
      return null
  }
}

export interface MatrixRow {
  habit: Habit
  cells: MatrixCell[]
}

export interface HabitMatrixInput {
  habits: readonly Habit[]
  entriesByHabit: Readonly<Record<string, readonly Entry[]>>
  /** Logical today (day-start aware). */
  today: string
  selectedDate: string
  /** The existing Today filter — kept separate from the Tiles/Matrix switch. */
  viewMode: 'scheduled' | 'all'
  /** Concrete vacation DATES (as vacationDatesInRange returns). */
  vacations?: readonly string[]
  epochsByHabit?: Readonly<Record<string, readonly ScheduleEpoch[] | undefined>>
}

export interface HabitMatrixData {
  /** Seven dates, Monday..Sunday. */
  dates: string[]
  rows: MatrixRow[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Accessible description per state (tooltips + aria-labels). */
export const MATRIX_STATE_LABEL: Record<MatrixCellState, string> = {
  done: 'done',
  pending: 'pending',
  skipped: 'skipped (neutral day)',
  unscheduled: 'not scheduled',
  vacation: 'vacation (paused)',
  future: 'future',
  'before-start': 'before the habit started',
}

/** Scheduled-view row eligibility: visible on at least one date of the
 *  displayed week that is not in the future. Each day is evaluated as of
 *  itself (today bound = that date), so historical eligibility never sees
 *  later check-ins. */
function weekEligible(
  habit: Habit,
  entries: readonly Entry[],
  dates: readonly string[],
  today: string,
  vacations: readonly string[],
  epochs: readonly ScheduleEpoch[] | undefined,
): boolean {
  return dates.some(
    (d) => d <= today && shouldShowHabitOnDate(habit, entries, d, d, vacations, epochs) === 'visible',
  )
}

function buildCell(
  habit: Habit,
  date: string,
  weekday: string,
  selectedDate: string,
  today: string,
  vacations: readonly string[],
  epochs: readonly ScheduleEpoch[] | undefined,
  entry: Entry | undefined,
): MatrixCell {
  const d = parseLocalDate(date)
  const base = { date, weekday, dayNumber: d.getDate(), selected: date === selectedDate, isToday: date === today }
  if (date > today) {
    // Future placeholders carry NO completion values.
    return { ...base, state: 'future' }
  }
  const status = dayStatus({ habit, date, entry, today, vacations, schedule: epochs })
  const state: MatrixCellState =
    status === 'done'
      ? 'done'
      : status === 'skipped'
        ? 'skipped'
        : status === 'vacation'
          ? 'vacation'
          : status === 'unscheduled'
            ? 'unscheduled'
            : status === 'before-start'
              ? 'before-start'
              : 'pending' // 'missed' (and an unreachable 'future')
  const value = entry && entry.status !== 'skipped' ? entry.value : undefined
  return { ...base, state, value }
}

export function buildHabitMatrix({
  habits,
  entriesByHabit,
  today,
  selectedDate,
  viewMode,
  vacations = [],
  epochsByHabit = {},
}: HabitMatrixInput): HabitMatrixData {
  const monday = weekStart(selectedDate)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const rows: MatrixRow[] = []
  for (const habit of habits) {
    if (habit.archived) continue // All Habits = active, non-archived only
    const entries = entriesByHabit[habit.id] ?? []
    const epochs = epochsByHabit[habit.id]
    if (viewMode === 'scheduled' && !weekEligible(habit, entries, dates, today, vacations, epochs)) continue
    rows.push({
      habit,
      cells: dates.map((date, i) =>
        buildCell(
          habit,
          date,
          WEEKDAYS[i],
          selectedDate,
          today,
          vacations,
          epochs,
          entries.find((e) => e.date === date),
        ),
      ),
    })
  }
  return { dates, rows }
}

/** Accessible per-cell label (locale-independent EN, matching the app copy
 *  and the week-strip label approach). Future cells expose no values. */
export function matrixCellLabel(cell: MatrixCell): string {
  const month = MONTHS[parseLocalDate(cell.date).getMonth()]
  return `${cell.weekday}, ${month} ${cell.dayNumber} — ${MATRIX_STATE_LABEL[cell.state]}`
}

/** Table caption for screen readers. */
export function matrixCaption(dates: readonly string[]): string {
  const first = parseLocalDate(dates[0])
  const last = parseLocalDate(dates[6])
  return `Habit checklist · Mon, ${MONTHS[first.getMonth()]} ${first.getDate()} – Sun, ${MONTHS[last.getMonth()]} ${last.getDate()}`
}

/** Full date label for a column header ("Mon, Jan 5"). */
export function matrixDateLabel(date: string): string {
  const d = parseLocalDate(date)
  const weekday = WEEKDAYS[(d.getDay() + 6) % 7]
  return `${weekday}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** Numeric-cell progress (UI 2.0 Stage 2 final refinement): a bottom-to-top
 *  fill percent plus a compact "3/9" chip label for partial numeric progress.
 *  Purely presentational — scoring/completion logic is untouched; the value
 *  and target are the habit's own stored numbers.
 *
 *  Safety rules: missing/invalid (non-finite) values show NO progress and NO
 *  label (nothing misleading) — the 0/target DISPLAY fallback for untouched
 *  cells is the caller's job (numericCellDisplayValue), so a recorded zero
 *  and an untouched cell render identically through it; negative values
 *  clamp to 0 visually while the
 *  stored value stays untouched; over-target values clamp the FILL to 100%
 *  but the label keeps the actual numbers ("12/9"). Labels longer than 5
 *  characters ("100/100") would clip inside the 32px chip, so they return
 *  null and the accessible fallback (aria-label/title, which always carry
 *  the exact value/target/unit) takes over. A valid-but-nonpositive target
 *  disables progress entirely. */
export function numericCellProgress(
  value: number | undefined | null,
  target: number,
): { pct: number; label: string | null } {
  if (!Number.isFinite(target) || target <= 0) return { pct: 0, label: null }
  if (value == null || !Number.isFinite(value)) return { pct: 0, label: null }
  const v = Math.max(0, value)
  const pct = Math.max(0, Math.min(100, (v / target) * 100))
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))
  const label = `${fmt(v)}/${fmt(target)}`
  return { pct, label: label.length <= 5 ? label : null }
}

/** Display-only numeric value for a cell: the STORED entry value when one
 *  exists, otherwise a display fallback of 0 for eligible PENDING numeric
 *  cells — so an untouched cell reads "0/target" exactly like a recorded
 *  zero. Every other state (skipped, vacation, unscheduled, future,
 *  before-start) keeps its value-less appearance. Pure display: it never
 *  creates, persists or marks anything — the value editor still prefills
 *  from the STORED cell.value (empty for untouched cells, "0" for recorded
 *  zeros) and no zero row is ever written for rendering. */
export function numericCellDisplayValue(cell: MatrixCell): number | undefined {
  if (cell.value != null) return cell.value
  return cell.state === 'pending' ? 0 : undefined
}

/** Name-pane width levels (approved Matrix width adjustment): the density
 *  pill doubles as a "Habit names" stepper in Matrix mode. Level 1 is the
 *  production pane (30% of the card, min 7.5rem — styled by classes, this
 *  module adds nothing); each level above 1 widens the pane by exactly ONE
 *  existing date-column width.
 *
 *  The increment is DERIVED, not arbitrary: the dates table is seven equal
 *  columns with a 300px minimum (the component's `min-w-[300px]` — keep the
 *  two in sync), so on the mobile viewports the table pins at its minimum
 *  and a real column is 300/7 ≈ 42.86px. Level 2 therefore hides roughly one
 *  of the ~4 visible dates, level 3 two, level 4 three — exactly the
 *  approved "names + Mon/Tue/Wed/Thu → Mon" progression, while date-column
 *  widths themselves never change (the table stays 300px until the
 *  viewport genuinely fits more than its minimum).
 *
 *  The pane also carries a responsive max so at least one complete date
 *  column always remains visible even at 320px: the flex row is the card's
 *  content width, so reserving one column plus a 6px breathing gap bounds
 *  the pane without any JS measuring. */

export const MATRIX_NAME_WIDTH_MIN_LEVEL = 1
export const MATRIX_NAME_WIDTH_MAX_LEVEL = 4

export function clampMatrixNameLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return MATRIX_NAME_WIDTH_MIN_LEVEL
  return Math.min(MATRIX_NAME_WIDTH_MAX_LEVEL, Math.max(MATRIX_NAME_WIDTH_MIN_LEVEL, Math.round(n)))
}

/** Inline style for the fixed habit-name pane. Level 1 returns an empty
 *  object so the production classes (`w-[30%] min-w-[7.5rem]`) apply
 *  unchanged; higher levels override `width` (level 1 base + one date
 *  column per step) and cap `maxWidth` at (row − one column − 6px). Plain
 *  object, no React import — the lib stays framework-free. */
export function matrixNamePaneStyle(level: number): { width?: string; maxWidth?: string } {
  const l = clampMatrixNameLevel(level)
  if (l <= MATRIX_NAME_WIDTH_MIN_LEVEL) return {}
  return {
    width: `calc(30% + ${l - 1} * (300px / 7))`,
    maxWidth: 'calc(100% - (300px / 7) - 6px)',
  }
}

/** Selected-date reveal geometry (pure, unit-testable): given the matrix
 *  scroll container's state and the selected column's content-space rect,
 *  return the scrollLeft that makes the WHOLE column visible — counting the
 *  sticky habit-name column as obstruction (content hidden behind it does
 *  NOT count as visible) — or null when no scroll is needed. Minimum
 *  distance: aligns the column's far edge, then guarantees it starts clear
 *  of the sticky width; clamped to the container's scrollable range. */
export interface RevealGeometryInput {
  scrollLeft: number
  clientWidth: number
  scrollWidth: number
  stickyWidth: number
  /** Column left edge in scroll-content coordinates. */
  columnLeft: number
  columnWidth: number
}

export function revealColumnScroll({
  scrollLeft,
  clientWidth,
  scrollWidth,
  stickyWidth,
  columnLeft,
  columnWidth,
}: RevealGeometryInput): number | null {
  const max = Math.max(0, scrollWidth - clientWidth)
  const clamp = (v: number) => Math.max(0, Math.min(max, v))
  const columnRight = columnLeft + columnWidth
  // Feasible scrollLeft band (column narrower than the usable viewport, the
  // only real case for a 43–60px date column):
  //   lower — smallest scrollLeft keeping the RIGHT edge inside the viewport
  //   upper — largest scrollLeft keeping the LEFT edge clear of the sticky
  //     habit-name column (content behind it does NOT count as visible)
  const lower = columnRight - clientWidth
  const upper = columnLeft - stickyWidth
  if (scrollLeft >= lower && scrollLeft <= upper) return null
  const target = scrollLeft < lower ? clamp(lower) : clamp(upper)
  // No-op within rounding noise (e.g. a column that can never clear the
  // sticky column because it sits inside its content footprint).
  if (Math.abs(target - scrollLeft) < 1) return null
  return target
}
