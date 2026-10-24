import { useId } from 'react'

// Seal shape: r(theta) = 10 + 1.1 * cos(8 * theta), sampled at 120 points
// Computed once as a constant so it is not regenerated on every render.
const SEAL_PATH = (() => {
  const points: string[] = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const theta = (i / n) * 2 * Math.PI
    const r = 10 + 1.1 * Math.cos(8 * theta)
    const x = 12 + r * Math.cos(theta)
    const y = 12 + r * Math.sin(theta)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  points.push('Z')
  return points.join(' ')
})()

interface Props {
  size?: number
  className?: string
}

/** Verified badge: blue scalloped seal with a white checkmark. */
export function VerifiedBadge({ size = 22, className }: Props) {
  const gradientId = useId()

  return (
    <svg
      role="img"
      aria-label="Verified"
      className={`size-[${size}px] ${className ?? ''}`}
      style={{ width: size, height: size, filter: 'drop-shadow(0 0 6px rgba(29,124,242,0.55))' }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#4DA6FF" />
          <stop offset="100%" stopColor="#1D7CF2" />
        </linearGradient>
      </defs>
      <path d={SEAL_PATH} fill={`url(#${gradientId})`} />
      <path
        d="M7.6 12.4 L10.7 15.4 L16.6 9.2"
        fill="none"
        stroke="white"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
