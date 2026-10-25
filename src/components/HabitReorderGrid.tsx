import { useRef, useState } from 'react'
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
import { HabitTile } from './HabitTile'
import { SortableHabitTile } from './SortableHabitTile'

interface Props {
  /** Ordered active habits (already in habit order from the shared list). */
  habits: Habit[]
  entriesByHabit: Record<string, Entry[]>
  selectedDate: string
  today: string
  /** Jiggle mode state, owned by the page (the header reacts to it). */
  reorderMode: boolean
  enterReorderMode: () => void
  reorderHabits: (orderedIds: string[]) => Promise<void>
  onNotice: (kind: 'success' | 'danger', text: string) => void
  onToggle: (habit: Habit) => void
  onLogValue: (habit: Habit, value: number) => void
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
  reorderMode,
  enterReorderMode,
  reorderHabits,
  onNotice,
  onToggle,
  onLogValue,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tileSize, setTileSize] = useState<{ width?: number; height?: number }>({})
  /** Swallow-click window: set to Date.now() + 150 on every drop, checked by
   *  each SortableHabitTile's capture-phase click handler. */
  const swallowClickUntil = useRef(0)

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
    setTileSize({
      width: event.active.rect.current.initial?.width,
      height: event.active.rect.current.initial?.height,
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
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={habits.map((h) => h.id)} strategy={rectSortingStrategy}>
        <ul
          aria-label="Habits"
          className={`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-5 ${reorderMode ? 'reorder-grid' : ''}`}
        >
          {habits.map((habit, i) => {
            const list = entriesByHabit[habit.id] ?? []
            const entry = list.find((e) => e.date === selectedDate)
            return (
              <SortableHabitTile
                key={habit.id}
                habit={habit}
                done={entry != null && isDone(habit, entry)}
                streak={currentStreak(habit, list, today)}
                value={entry ? entry.value : null}
                index={i}
                reorderMode={reorderMode}
                swallowClickRef={swallowClickUntil}
                onToggle={() => onToggle(habit)}
                onLogValue={(v) => onLogValue(habit, v)}
              />
            )
          })}
        </ul>
      </SortableContext>

      {/* Drag preview: a floating copy of the tile, lifted 4% with a glow. */}
      {activeId &&
        (() => {
          const index = habits.findIndex((h) => h.id === activeId)
          const habit = habits[index]
          if (!habit) return null
          const list = entriesByHabit[habit.id] ?? []
          const entry = list.find((e) => e.date === selectedDate)
          return (
            <DragOverlay style={{ width: tileSize.width, height: tileSize.height }}>
              <div className="tile-dragged h-full w-full">
                <HabitTile
                  habit={habit}
                  done={entry != null && isDone(habit, entry)}
                  streak={currentStreak(habit, list, today)}
                  value={entry ? entry.value : null}
                  index={index}
                  overlay
                  onToggle={() => {}}
                  onLogValue={() => {}}
                />
              </div>
            </DragOverlay>
          )
        })()}
    </DndContext>
  )
}
