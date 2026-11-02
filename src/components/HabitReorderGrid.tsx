import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { moveHabit } from '../lib/order'
import { currentStreak, isDone, type Entry, type Habit } from '../lib/score'
import { parseLocalDate } from '../lib/dates'
import { HabitTile } from './HabitTile'
import { SortableHabitTile } from './SortableHabitTile'

/** Short date label for the "Skip <day>" menu item on backfilled dates. */
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

interface Props {
  /** Ordered active habits (already in habit order from the shared list). */
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  selectedDate: string
  today: string
  /** Concrete vacation dates in the stats window: the selected date being a
   *  vacation day mutes tiles (neutral) with a "Vacation" caption, but
   *  check-ins still work (done wins). */
  vacations?: readonly string[]
  /** Tiles per row the user picked (1–6, persisted on the Today page). */
  perRow: number
  /** Jiggle mode state, owned by the page (the header reacts to it). */
  reorderMode: boolean
  enterReorderMode: () => void
  /** Tap/click outside a tile (or Escape on the page) exits the mode. */
  exitReorderMode: () => void
  reorderHabits: (orderedIds: string[]) => Promise<void>
  onNotice: (kind: 'success' | 'danger', text: string) => void
  onToggle: (habit: Habit) => void
  onLogValue: (habit: Habit, value: number) => void
  onSkip: (habit: Habit) => void
}

/** Sortable habit-tile grid for Today (DESIGN.md §8 row 2). A 350ms
 *  long-press (mouse + touch; 8px tolerance) lifts a tile into reorder
 *  mode — every tile jiggles while the others slide around via dnd-kit — and
 *  a drop saves the new order through `reorderHabits`. The dragged tile
 *  renders in a scaled DragOverlay so the source slot keeps its place. */
export function HabitReorderGrid({
  habits,
  entriesByHabit,
  selectedDate,
  today,
  vacations = [],
  perRow,
  reorderMode,
  enterReorderMode,
  exitReorderMode,
  reorderHabits,
  onNotice,
  onToggle,
  onLogValue,
  onSkip,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tileSize, setTileSize] = useState<{ width?: number; height?: number }>({})
  /** Swallow-click window: set to Date.now() + 150 on every drop, checked by
   *  each SortableHabitTile's capture-phase click handler. */
  const swallowClickUntil = useRef(0)

  // Exit affordance (user request): while in reorder mode, a pointerdown
  // outside a tile exits the mode — on touch and mouse alike. Pointerdown
  // (not click) is deliberate: drags end with pointerup, so no trailing
  // drop event can ever accidentally exit, and mode stays on across
  // multiple rearranges. Taps on the grid/gaps/header/footer all count;
  // a touch starting on a tile stays a drag/tap on that tile.
  useEffect(() => {
    if (!reorderMode) return
    function outside(e: PointerEvent) {
      const target = e.target as Element | null
      if (target?.closest('.tile-cell')) return
      if (swallowClickUntil.current > Date.now()) return
      exitReorderMode()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [reorderMode, exitReorderMode])

  // Rebuilt when the mode changes: outside reorder mode a long-press (350ms,
  // 8px tolerance) is what lifts the first tile into the mode; inside the
  // mode drags start after a 4px nudge so they feel immediate. dnd-kit reads
  // the sensor options at activation time (useSensorSetup only depends on the
  // sensor classes), so swapping the constraint mid-drag is safe.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: reorderMode ? { distance: 4 } : { delay: 350, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: reorderMode ? { distance: 4 } : { delay: 350, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    console.debug('[reorder] drag start:', String(event.active.id))
    // Size the DragOverlay copy from the dragged tile's <li>. Never let the
    // overlay fall back to width:auto: dnd-kit builds its style as
    // `{ ...rect, ...userStyle }`, so a user style of `width: undefined`
    // would cancel its rect width and the fixed-position ghost would
    // shrink-to-fit (collapse to ~content width). Measure the li ourselves
    // (closest('.tile-cell') — handles mouse, touch AND keyboard activation)
    // and only set the keys we actually have.
    const li =
      event.activatorEvent && 'target' in event.activatorEvent
        ? ((event.activatorEvent.target as Element | null)?.closest('.tile-cell') as HTMLElement | null)
        : null
    const liRect = li?.getBoundingClientRect()
    setTileSize({
      width: liRect?.width ?? event.active.rect.current.initial?.width,
      height: liRect?.height ?? event.active.rect.current.initial?.height,
    })
    if (!reorderMode) {
      console.debug('[reorder] activating reorder mode')
      enterReorderMode()
      navigator.vibrate?.(12)
    }
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    console.debug(
      '[reorder] drag over: active',
      String(event.active.id),
      '→ over',
      event.over ? String(event.over.id) : 'none',
    )
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    navigator.vibrate?.(12)
    // Swallow the synthetic click that trails the drop, whatever happens next.
    swallowClickUntil.current = Date.now() + 150
    console.debug('[reorder] old order:', habits.map((h) => h.id).join(','))
    if (!over) {
      console.debug('[reorder] dropped outside — no change')
      return
    }
    const nextIds = moveHabit(habits, String(active.id), String(over.id)).map((h) => h.id)
    console.debug('[reorder] new order:', nextIds.join(','))
    if (nextIds.join('|') === habits.map((h) => h.id).join('|')) {
      console.debug('[reorder] order unchanged — skipping save')
      return
    }
    console.debug('[reorder] calling reorderHabits with', nextIds.length, 'ids')
    await reorderHabits(nextIds)
    console.debug('[reorder] reorderHabits finished — saved order:', nextIds.join(','))
    // reorderHabits fails soft: if it rolled back, the page's reorderError
    // effect swaps this toast for the failure message.
    onNotice('success', 'Order saved')
  }

  return (
    <DndContext
      sensors={sensors}
      // Autoscroll while dragging near the viewport edges: default scroller
      // detection finds the window (main is not its own scroll container).
      // threshold y = 20% of the viewport height, x = 0 (no horizontal edge).
      autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 10 }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={habits.map((h) => h.id)} strategy={rectSortingStrategy}>
        <ul
          aria-label="Habits"
          className={`tile-grid mt-4 grid pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:mt-5 lg:pb-0 ${reorderMode ? 'reorder-grid' : ''}`}
          style={
            {
              '--tile-cols': perRow,
              // Narrower gaps as the grid gets denser (phones with 5–6 per row).
              '--tile-gap': perRow >= 5 ? '8px' : perRow >= 3 ? '12px' : '16px',
            } as CSSProperties
          }
        >
          {habits.map((habit, i) => {
            const list = entriesByHabit[habit.id] ?? []
            const entry = list.find((e) => e.date === selectedDate)
            const entrySkipped = entry?.status === 'skipped'
            const done = entry != null && isDone(habit, entry)
            // Vacation-day neutrality (done wins): a muted tile with a
            // "Vacation" caption; the "more" menu still works on row state.
            const vacationDay = vacations.includes(selectedDate)
            const neutral = (entrySkipped || vacationDay) && !done
            return (
              <SortableHabitTile
                key={habit.id}
                habit={habit}
                done={done}
                skipped={neutral}
                skippedRow={entrySkipped}
                skippedLabel={entrySkipped ? 'Skipped' : 'Vacation'}
                streak={currentStreak(habit, list, today, vacations)}
                // A skipped row's value (0) is never a real value.
                value={entry && !entrySkipped ? entry.value : null}
                dayLabel={selectedDate === today ? 'today' : SHORT_DATE_FMT.format(parseLocalDate(selectedDate))}
                index={i}
                reorderMode={reorderMode}
                swallowClickRef={swallowClickUntil}
                onToggle={() => onToggle(habit)}
                onLogValue={(v) => onLogValue(habit, v)}
                onSkipToggle={() => onSkip(habit)}
              />
            )
          })}
        </ul>
      </SortableContext>

      {/* Drag preview: a floating copy of the tile, lifted 4% with a glow.
          Portalled to document.body because the fixed overlay's ancestors
          (`glass-card app-shell` in AppShell) carry backdrop-filter — which
          creates a containing block for fixed descendants and would anchor
          the overlay to the shell box instead of the viewport (top of the
          page when scrolled). Outside the shell it also keeps full theme
          tokens (:root/<html class="dark">) above the dock and toasts. */}
      {activeId &&
        (() => {
          const index = habits.findIndex((h) => h.id === activeId)
          const habit = habits[index]
          if (!habit) return null
          const list = entriesByHabit[habit.id] ?? []
          const entry = list.find((e) => e.date === selectedDate)
          const entrySkipped = entry?.status === 'skipped'
          const overlayDone = entry != null && isDone(habit, entry)
          const overlayNeutral = (entrySkipped || vacations.includes(selectedDate)) && !overlayDone
          // Only set width/height when measured (undefined would cancel
          // dnd-kit's rect width and shrink-to-fit the overlay — see
          // handleDragStart).
          const overlayStyle: CSSProperties = { pointerEvents: 'none' }
          if (tileSize.width != null) overlayStyle.width = tileSize.width
          if (tileSize.height != null) overlayStyle.height = tileSize.height
          return createPortal(
            <DragOverlay
              // dnd-kit itself applies top/left and the measured width/height
              // of the active tile (active.rect.current.initial) — the same
              // rect captured in handleDragStart is repeated here as an
              // explicit guarantee. zIndex 999 is the default and sits above
              // the dock (z-30) and toasts (z-40); the overlay must never
              // intercept pointer events (it's a ghost).
              style={overlayStyle}
            >
              <div className={`tile-dragged tile-cell h-full w-full`}>
                <HabitTile
                  habit={habit}
                  done={overlayDone}
                  skipped={overlayNeutral}
                  skippedRow={entrySkipped}
                  skippedLabel={entrySkipped ? 'Skipped' : 'Vacation'}
                  streak={currentStreak(habit, list, today, vacations)}
                  // A skipped row's value (0) is never a real value.
                  value={entry && !entrySkipped ? entry.value : null}
                  dayLabel={selectedDate === today ? 'today' : SHORT_DATE_FMT.format(parseLocalDate(selectedDate))}
                  index={index}
                  overlay
                  onToggle={() => {}}
                  onLogValue={() => {}}
                  onSkipToggle={() => {}}
                />
              </div>
            </DragOverlay>,
            document.body,
          )
        })()}
    </DndContext>
  )
}
