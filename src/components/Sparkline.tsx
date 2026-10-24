export type ScorePointLike = { score: number }

/** Minimal sparkline (DESIGN.md §8): habit-colored polyline with an end dot
 *  carrying a 3px white ring. Pure SVG — no chart library needed at this size. */
export function Sparkline({ points, color }: { points: ScorePointLike[]; color: string }) {
  const n = points.length
  const viewBox = '0 0 100 36'

  if (n === 0) {
    return (
      <svg viewBox={viewBox} preserveAspectRatio="none" className="h-9 w-full" role="presentation">
        <line x1="2" y1="30" x2="98" y2="30" stroke="var(--chart-grid)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  // Downsample long series so the path stays smooth and tiny.
  const step = Math.max(1, Math.ceil(n / 60))
  const sampled = points.filter((_, i) => i % step === 0 || i === n - 1)
  const y = (score: number) => 32 - Math.max(0, Math.min(1, score)) * 28
  const denom = Math.max(1, sampled.length - 1)
  const path = sampled
    .map((p, i) => `${(2 + (96 * i) / denom).toFixed(2)} ${y(p.score).toFixed(2)}`)
    .join(' L ')

  const last = sampled[sampled.length - 1]
  const bottomPct = ((4 + Math.max(0, Math.min(1, last.score)) * 28) / 36) * 100

  return (
    <div className="relative">
      <svg viewBox={viewBox} preserveAspectRatio="none" className="h-9 w-full" role="presentation">
        <path
          d={`M${path}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="ring-[3px] ring-white absolute right-0 size-2 rounded-full"
        style={{ backgroundColor: color, bottom: `calc(${bottomPct}% - 4px)` }}
      />
    </div>
  )
}
