/** Minimal shape ordering works on — every Habit satisfies it. `sort_order`
 *  may be missing (legacy rows) and is then treated as 0. */
export type Orderable = { id: string; sort_order?: number; created_at: string }

/** One row of a changed sort_order at its new position (numbered from 1). */
export type OrderChange = { id: string; sort_order: number }

/** Total order for habits (AGENTS.md rule 8): sort_order ascending, then
 *  created_at ascending (local YYYY-MM-DD strings sort lexicographically),
 *  then id ascending — deterministic even for duplicated sort_order values
 *  or legacy rows where every sort_order is 0. */
export function compareOrder(a: Orderable, b: Orderable): number {
  const ao = a.sort_order ?? 0
  const bo = b.sort_order ?? 0
  if (ao !== bo) return ao - bo
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  if (a.id !== b.id) return a.id < b.id ? -1 : 1
  return 0
}

/** New sorted array following the single habit-order rule; the input is
 *  never mutated. This is the only sorting any habit view may use. */
export function sortHabits<T extends Orderable>(habits: readonly T[]): T[] {
  return [...habits].sort(compareOrder)
}

/** Drag-and-drop move: place the `activeId` item into the position of the
 *  `overId` item, returning a new array. If either id is unknown or the
 *  move is a no-op (same position) the input array is returned untouched. */
export function moveHabit<T extends { id: string }>(
  list: readonly T[],
  activeId: string,
  overId: string,
): readonly T[] {
  const from = list.findIndex((h) => h.id === activeId)
  const to = list.findIndex((h) => h.id === overId)
  if (from === -1 || to === -1 || from === to) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Rows whose position differs between `before` and `after`, numbered from 1
 *  in `after`'s order. Only these pairs need a database update; unmoved
 *  habits keep their existing sort_order. */
export function diffOrder(
  before: readonly Orderable[],
  after: readonly Orderable[],
): OrderChange[] {
  const position = new Map(before.map((h, i) => [h.id, i + 1]))
  const changes: OrderChange[] = []
  after.forEach((h, i) => {
    const sort_order = i + 1
    if (position.get(h.id) !== sort_order) changes.push({ id: h.id, sort_order })
  })
  return changes
}
