export const MAX_RINGS = 7
export const MAX_PER_RING = 4
export const MAX_HABITS_SHOWN = 28

export interface RingLayout {
  habitIds: string[]
}

export interface LayoutResult {
  rings: RingLayout[]
  hiddenCount: number
}

export function layoutRings(habitIds: string[]): LayoutResult {
  const n = Math.min(habitIds.length, MAX_HABITS_SHOWN)
  const hiddenCount = Math.max(0, habitIds.length - MAX_HABITS_SHOWN)

  if (n === 0) {
    return { rings: [], hiddenCount }
  }

  if (n <= MAX_RINGS) {
    const rings = habitIds.slice(0, n).map((id) => ({ habitIds: [id] }))
    return { rings, hiddenCount: 0 }
  }

  const k = Math.min(MAX_RINGS - 1, Math.floor((MAX_HABITS_SHOWN - n) / 3))
  const m = n - k
  const s = Math.ceil(m / MAX_PER_RING)

  const sharedRings: RingLayout[] = []
  for (let i = 0; i < s; i++) {
    const start = i * MAX_PER_RING
    const end = Math.min(start + MAX_PER_RING, m)
    sharedRings.push({ habitIds: habitIds.slice(start, end) })
  }

  const fullRings: RingLayout[] = []
  for (let i = 0; i < k; i++) {
    fullRings.push({ habitIds: [habitIds[m + i]] })
  }

  return { rings: [...sharedRings, ...fullRings], hiddenCount }
}

export interface RingGeometry {
  centerRadius: number
  rings: { radius: number; width: number }[]
}

export function ringGeometry(size: number, numRings: number): RingGeometry {
  const centerRadius = Math.max(48, size * 0.4)
  const availableOuter = size / 2 - centerRadius
  const ringWidth = Math.max(6, availableOuter / (numRings * 2))
  const rings = []
  let r = centerRadius
  for (let i = 0; i < numRings; i++) {
    r += ringWidth / 2
    rings.push({ radius: r, width: ringWidth })
    r += ringWidth / 2 + 2
  }
  return { centerRadius, rings }
}

export interface SegmentArc {
  startAngle: number
  endAngle: number
}

export function segmentArcs(
  radius: number,
  numSegments: number,
  gapPixels = 6,
): SegmentArc[] {
  const gapRad = gapPixels / radius
  const totalGapRad = numSegments * gapRad
  const availableRad = 2 * Math.PI - totalGapRad
  const segmentRad = availableRad / numSegments

  const arcs: SegmentArc[] = []
  let angle = -Math.PI / 2

  for (let i = 0; i < numSegments; i++) {
    arcs.push({
      startAngle: angle,
      endAngle: angle + segmentRad,
    })
    angle += segmentRad + gapRad
  }

  return arcs
}
