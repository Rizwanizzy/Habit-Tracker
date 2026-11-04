import { useEffect, useState } from 'react'
import {
  milestoneStatus,
  type MilestoneBadge,
} from '../lib/milestones'
import type { LifetimeStats } from '../lib/stats'
import { IconFlame, IconCheck } from './icons'

interface MilestonesCardProps {
  stats: LifetimeStats
  loading: boolean
}

function MilestoneItem({ badge, animated }: { badge: MilestoneBadge; animated: boolean }) {
  const isStreak = badge.kind === 'streak'
  const kindLabel = isStreak ? 'streak' : 'check-ins'

  let accessibleLabel = `${badge.threshold} ${kindLabel}`
  if (badge.unlocked) {
    accessibleLabel = isStreak
      ? `${badge.threshold}-day streak, unlocked`
      : `${badge.threshold} check-ins, unlocked`
  } else if (badge.isNext) {
    accessibleLabel = isStreak
      ? `${badge.threshold}-day streak, locked, ${badge.current} of ${badge.threshold} days`
      : `${badge.threshold} check-ins, locked, ${badge.current} of ${badge.threshold} check-ins`
  } else {
    accessibleLabel = isStreak
      ? `${badge.threshold}-day streak, locked`
      : `${badge.threshold} check-ins, locked`
  }

  // Caption: "days" / "check-ins" when unlocked or not next; "current / threshold" when isNext
  const captionText =
    badge.isNext && !badge.unlocked
      ? `${badge.current} / ${badge.threshold}`
      : isStreak
        ? 'days'
        : 'check-ins'

  // Progress ring circumference: radius = 20, C = 2 * PI * 20 ≈ 125.66
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = animated
    ? circumference * (1 - badge.progress)
    : circumference

  return (
    <li
      role="listitem"
      aria-label={accessibleLabel}
      className="flex flex-col items-center min-w-0"
    >
      <div className="relative size-11 shrink-0 flex items-center justify-center">
        {/* Next badge thin progress ring */}
        {badge.isNext && !badge.unlocked && (
          <svg
            className="absolute inset-0 size-11 -rotate-90 pointer-events-none"
            viewBox="0 0 44 44"
            aria-hidden="true"
          >
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
        )}

        {/* Badge circle */}
        <div
          className={`size-11 rounded-full flex items-center justify-center transition-all duration-200 ${
            badge.unlocked
              ? 'bg-accent-gradient glow-accent text-white shadow-md ring-2 ring-accent/60'
              : 'border border-border bg-surface-2 text-fg-muted/40'
          }`}
        >
          {isStreak ? (
            <IconFlame className={`size-5 ${badge.unlocked ? 'text-white' : 'text-fg-muted/50'}`} />
          ) : (
            <IconCheck className={`size-5 ${badge.unlocked ? 'text-white' : 'text-fg-muted/50'}`} />
          )}
        </div>
      </div>

      {/* Number label */}
      <span
        className={`mt-1.5 text-xs sm:text-sm font-semibold tracking-tight text-center leading-none ${
          badge.unlocked ? 'text-fg' : 'text-fg-secondary'
        }`}
      >
        {badge.threshold}
      </span>

      {/* Caption text */}
      <span
        className={`mt-0.5 text-[11px] leading-tight text-center truncate max-w-full ${
          badge.isNext && !badge.unlocked ? 'font-medium text-accent' : 'text-fg-muted'
        }`}
      >
        {captionText}
      </span>
    </li>
  )
}

export function MilestonesCard({ stats, loading }: MilestonesCardProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    // Delay progress ring animation slightly for entrance effect
    const timer = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(timer)
  }, [])

  const { badges } = milestoneStatus(stats)
  const allLocked = badges.every((b) => !b.unlocked)

  return (
    <section aria-label="Milestones" className="glass-card rounded-card p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border">
        <h2 className="text-base font-semibold text-fg">Milestones</h2>
        <span className="text-caption text-fg-muted">
          {badges.filter((b) => b.unlocked).length} / {badges.length}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="skeleton size-11 rounded-full" />
              <div className="skeleton mt-1.5 h-3.5 w-6 rounded-pill" />
              <div className="skeleton mt-1 h-3 w-10 rounded-pill" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul
            role="list"
            className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 lg:gap-x-4 lg:gap-y-5"
          >
            {badges.map((badge) => (
              <MilestoneItem key={badge.id} badge={badge} animated={animated} />
            ))}
          </ul>

          {allLocked && (
            <p className="mt-4 text-center text-xs text-fg-muted">
              Check in a habit to start your first streak.
            </p>
          )}
        </>
      )}
    </section>
  )
}
