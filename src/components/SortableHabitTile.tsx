import type { CSSProperties, MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HabitTile } from './HabitTile'
import type { Habit } from '../lib/score'

interface Props {
  habit: Habit
  done: boolean
  /** The displayed date is skipped (neutral) — muted tile, "more" menu flips. */
  skipped?: boolean
  /** Caption for a neutral day: "Skipped" or "Vacation" (vacation mode). */
  skippedLabel?: string
  /** Whether a status-'skipped' ROW exists (drives the menu item; a
   *  vacation day is neutral without any row). */
  skippedRow?: boolean
  streak: number
  value: number | null
  /** Label for the skip menu item: "today" or the selected date, short. */
  dayLabel?: string
  index: number
  reorderMode: boolean
  /** Set by the grid's onDragEnd; clicks are swallowed while pending. */
  swallowClickRef: { current: number }
  onToggle: () => void
  onLogValue: (value: number) => void
  onSkipToggle?: () => void
}

/** Grid item for one habit tile. The <li> always carries the sortable
 *  attributes/listeners (visible as aria-roledescription="sortable" in the
 *  DOM) — a long-press activates the drag via the sensors in
 *  HabitReorderGrid, and a plain click/tap still reaches the tile's own
 *  controls. `disabled` is deliberately NOT set: inside wiggle mode the
 *  sensors already use the distance-4 constraint, and disabling the
 *  listeners here would lock every drag after the first one until the user
 *  exited and re-entered the mode (the long-press that enters the mode
 *  starts outside it and survives the swap). */
export function SortableHabitTile({ reorderMode, habit, swallowClickRef, ...tile }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  function handleClickCapture(e: MouseEvent) {
    // A drag that just ended fires a trailing click on the pressed element;
    // swallow it for 150ms so a drop never triggers a check-in.
    if (swallowClickRef.current > Date.now()) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="tile-cell relative h-full"
      {...attributes}
      {...listeners}
      onClickCapture={handleClickCapture}
    >
      <HabitTile {...tile} habit={habit} reorderMode={reorderMode} />
      {isDragging && <div className="absolute inset-0 rounded-tile bg-surface" />}
    </li>
  )
}
