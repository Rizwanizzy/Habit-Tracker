/** Pure math for the alarm-clock WheelPicker (HabitFormMobile).
 *  Kept out of the component so the snap geometry is unit-tested. */

/** Height of one wheel row in px (must match WheelPicker's CSS). */
export const WHEEL_ITEM_H = 36

/** How far scrollTop is from true zero when the value list ends above the
 *  centre (negative while snapping past the first row, past the end below). */
export function indexFromScroll(
  scrollTop: number,
  itemHeight: number,
  count: number,
): number {
  if (count <= 0) return 0
  const raw = Math.round(scrollTop / itemHeight)
  return Math.min(count - 1, Math.max(0, raw))
}

/** Index (0-based) → wheel value. */
export function valueFromIndex(index: number, min: number): number {
  return min + index
}

/** scrollTop that puts `value` in the centre band (padding = itemHeight). */
export function scrollTopForValue(
  value: number,
  itemHeight: number,
  min: number,
): number {
  const clamped = Math.max(min, value)
  return (clamped - min) * itemHeight
}

/** Spinner range: at least `defaultMax`, widened so a saved (edit mode)
 *  value larger than the default is still reachable — nothing is lost. */
export function rangeFor(
  value: number,
  min: number,
  defaultMax: number,
): { min: number; max: number } {
  return { min, max: Math.max(min, Math.max(defaultMax, value)) }
}
