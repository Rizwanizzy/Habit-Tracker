import type { LifetimeStats } from './stats'

export const STREAK_MILESTONES = [7, 21, 66, 100] as const
export const CHECKIN_MILESTONES = [25, 100, 500, 1000] as const

export type MilestoneKind = 'streak' | 'checkins'

export interface MilestoneBadge {
  id: string
  kind: MilestoneKind
  threshold: number
  unlocked: boolean
  current: number
  /** Progress towards this milestone, clamped between 0 and 1. */
  progress: number
  /** True if this is the immediate next locked badge of its kind. */
  isNext?: boolean
}

export interface MilestoneStatusResult {
  badges: MilestoneBadge[]
  nextLocked: {
    streak: MilestoneBadge | null
    checkins: MilestoneBadge | null
  }
  nextStreakBadge: MilestoneBadge | null
  nextCheckinBadge: MilestoneBadge | null
}

/** Pure milestone computation deriving unlocked badges and the next target. */
export function milestoneStatus(
  stats: Pick<LifetimeStats, 'longestStreak' | 'totalCheckIns'>,
): MilestoneStatusResult {
  const streakCurrent = stats?.longestStreak?.days ?? 0
  const checkinCurrent = stats?.totalCheckIns ?? 0

  // 1. Streak badges
  const streakBadges: MilestoneBadge[] = STREAK_MILESTONES.map((threshold) => {
    const unlocked = streakCurrent >= threshold
    const progress = Math.min(1, Math.max(0, streakCurrent / threshold))
    return {
      id: `streak-${threshold}`,
      kind: 'streak',
      threshold,
      unlocked,
      current: streakCurrent,
      progress,
    }
  })

  // Next locked streak badge
  const nextStreakBadge = streakBadges.find((b) => !b.unlocked) ?? null
  if (nextStreakBadge) {
    nextStreakBadge.isNext = true
  }

  // 2. Check-in badges
  const checkinBadges: MilestoneBadge[] = CHECKIN_MILESTONES.map((threshold) => {
    const unlocked = checkinCurrent >= threshold
    const progress = Math.min(1, Math.max(0, checkinCurrent / threshold))
    return {
      id: `checkins-${threshold}`,
      kind: 'checkins',
      threshold,
      unlocked,
      current: checkinCurrent,
      progress,
    }
  })

  // Next locked check-in badge
  const nextCheckinBadge = checkinBadges.find((b) => !b.unlocked) ?? null
  if (nextCheckinBadge) {
    nextCheckinBadge.isNext = true
  }

  const badges = [...streakBadges, ...checkinBadges]

  return {
    badges,
    nextLocked: {
      streak: nextStreakBadge,
      checkins: nextCheckinBadge,
    },
    nextStreakBadge,
    nextCheckinBadge,
  }
}
