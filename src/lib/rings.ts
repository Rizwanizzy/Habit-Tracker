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
  const outer = size / 2
  if (numRings <= 0) {
    return { centerRadius: outer, rings: [] }
  }

  // The center hole never shrinks below 96px in diameter (when the box shows
  // at 240 CSS px), and strokes never bloat past widthMax so 1–2-ring layouts
  // stay elegant. Both scale with `size` for other viewBoxes.
  const holeMin = Math.max(48, size * 0.2)
  const widthMax = Math.max(12, size * 0.05)
  const band = outer - holeMin

  // Exact fit when every gap is the 2px minimum…
  let ringWidth = (band - 2 * (numRings - 1)) / numRings
  // …or a proportional gap for thick strokes, solved so the rings still fit.
  if (ringWidth > 9 && ringWidth <= widthMax) {
    ringWidth = band / (numRings + 0.22 * (numRings - 1))
  }
  ringWidth = Math.min(widthMax, Math.max(6, ringWidth))
  const gap = Math.max(2, ringWidth * 0.22)

  // Pack the rings edge to edge, centered within the band: half of the
  // widening slack opens the center hole, half becomes an outer margin. The
  // hole therefore shrinks as habits (rings) are added, down to its minimum.
  const used = numRings * ringWidth + (numRings - 1) * gap
  const slack = Math.max(0, band - used)
  const innermostInner = holeMin + slack / 2

  const rings = []
  for (let i = 0; i < numRings; i++) {
    rings.push({
      radius: innermostInner + ringWidth / 2 + i * (ringWidth + gap),
      width: ringWidth,
    })
  }
  return { centerRadius: innermostInner, rings }
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
