import type { CSSProperties, MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HabitTile } from './HabitTile'
import type { Habit } from '../lib/score'

interface Props {
  habit: Habit
  done: boolean
  streak: number
  value: number | null
  index: number
  reorderMode: boolean
  /** Set by the grid's onDragEnd; clicks are swallowed while pending. */
  swallowClickRef: { current: number }
  onToggle: () => void
  onLogValue: (value: number) => void
}

/** Grid item for one habit tile. The <li> always carries the sortable
 *  attributes/listeners (visible as aria-roledescription="sortable" in the
 *  DOM) — a long-press activates the drag via the sensors in
 *  HabitReorderGrid, and a plain click/tap still reaches the tile's own
 *  controls. Attributes and listeners are spread unconditionally, together
 *  with ref={setNodeRef} and the transform/transition style. */
export function SortableHabitTile({ reorderMode, habit, swallowClickRef, ...tile }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  /** A drag sequence ends with a synthetic click; swallowing it for a short
   *  window (set in onDragEnd, ~150ms) means a drop never toggles a habit or
   *  opens a link. */
  function swallowClick(e: MouseEvent<HTMLLIElement>) {
    if (Date.now() < swallowClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      onContextMenu={(e) => {
        if (reorderMode) e.preventDefault()
      }}
      onClickCapture={swallowClick}
      {...attributes}
      {...listeners}
      draggable={false}
      className="rounded-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className={reorderMode && isDragging ? 'tile-ghost h-full' : 'h-full'}>
        <HabitTile habit={habit} reorderMode={reorderMode} {...tile} />
      </div>
    </li>
  )
}
