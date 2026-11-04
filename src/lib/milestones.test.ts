import { describe, expect, it } from 'vitest'
import {
  CHECKIN_MILESTONES,
  milestoneStatus,
  STREAK_MILESTONES,
} from './milestones'

describe('milestones', () => {
  it('exports milestone constants', () => {
    expect(STREAK_MILESTONES).toEqual([7, 21, 66, 100])
    expect(CHECKIN_MILESTONES).toEqual([25, 100, 500, 1000])
  })

  it('handles empty / zero data with nothing unlocked and first badges as next', () => {
    const res = milestoneStatus({
      longestStreak: { days: 0, habitId: null },
      totalCheckIns: 0,
    })

    expect(res.badges.every((b) => !b.unlocked)).toBe(true)
    expect(res.nextStreakBadge?.threshold).toBe(7)
    expect(res.nextStreakBadge?.isNext).toBe(true)
    expect(res.nextCheckinBadge?.threshold).toBe(25)
    expect(res.nextCheckinBadge?.isNext).toBe(true)
  })

  it('tests threshold boundaries correctly: 6 locked, 7 unlocked', () => {
    const res6 = milestoneStatus({
      longestStreak: { days: 6, habitId: 'h1' },
      totalCheckIns: 24,
    })
    const streak7BadgeAt6 = res6.badges.find((b) => b.id === 'streak-7')
    expect(streak7BadgeAt6?.unlocked).toBe(false)
    expect(streak7BadgeAt6?.progress).toBeCloseTo(6 / 7)
    expect(streak7BadgeAt6?.isNext).toBe(true)

    const checkin25BadgeAt24 = res6.badges.find((b) => b.id === 'checkins-25')
    expect(checkin25BadgeAt24?.unlocked).toBe(false)
    expect(checkin25BadgeAt24?.progress).toBeCloseTo(24 / 25)
    expect(checkin25BadgeAt24?.isNext).toBe(true)

    const res7 = milestoneStatus({
      longestStreak: { days: 7, habitId: 'h1' },
      totalCheckIns: 25,
    })
    const streak7BadgeAt7 = res7.badges.find((b) => b.id === 'streak-7')
    expect(streak7BadgeAt7?.unlocked).toBe(true)
    expect(streak7BadgeAt7?.progress).toBe(1)
    expect(streak7BadgeAt7?.isNext).toBeUndefined()

    const checkin25BadgeAt25 = res7.badges.find((b) => b.id === 'checkins-25')
    expect(checkin25BadgeAt25?.unlocked).toBe(true)
    expect(checkin25BadgeAt25?.progress).toBe(1)

    // Next badge shifts to 21 for streak and 100 for checkins
    expect(res7.nextStreakBadge?.threshold).toBe(21)
    expect(res7.nextStreakBadge?.isNext).toBe(true)
    expect(res7.nextCheckinBadge?.threshold).toBe(100)
    expect(res7.nextCheckinBadge?.isNext).toBe(true)
  })

  it('computes correct progress values and clamps to 1 when unlocked', () => {
    const res = milestoneStatus({
      longestStreak: { days: 14, habitId: 'h1' },
      totalCheckIns: 50,
    })

    const streak7 = res.badges.find((b) => b.id === 'streak-7')
    expect(streak7?.unlocked).toBe(true)
    expect(streak7?.progress).toBe(1)

    const streak21 = res.badges.find((b) => b.id === 'streak-21')
    expect(streak21?.unlocked).toBe(false)
    expect(streak21?.progress).toBeCloseTo(14 / 21)
    expect(streak21?.isNext).toBe(true)

    const checkin100 = res.badges.find((b) => b.id === 'checkins-100')
    expect(checkin100?.unlocked).toBe(false)
    expect(checkin100?.progress).toBe(0.5)
    expect(checkin100?.isNext).toBe(true)
  })

  it('selects exactly one next badge per kind', () => {
    const res = milestoneStatus({
      longestStreak: { days: 30, habitId: 'h1' },
      totalCheckIns: 150,
    })

    // Streak: 7 and 21 unlocked; 66 is the next locked; 100 is locked but NOT next
    expect(res.nextStreakBadge?.threshold).toBe(66)
    const streak66 = res.badges.find((b) => b.id === 'streak-66')
    const streak100 = res.badges.find((b) => b.id === 'streak-100')
    expect(streak66?.isNext).toBe(true)
    expect(streak100?.isNext).toBeUndefined()

    // Checkins: 25 and 100 unlocked; 500 is next locked; 1000 is locked but NOT next
    expect(res.nextCheckinBadge?.threshold).toBe(500)
    const checkin500 = res.badges.find((b) => b.id === 'checkins-500')
    const checkin1000 = res.badges.find((b) => b.id === 'checkins-1000')
    expect(checkin500?.isNext).toBe(true)
    expect(checkin1000?.isNext).toBeUndefined()
  })

  it('unlocks everything beyond the top threshold and has null nextLocked', () => {
    const res = milestoneStatus({
      longestStreak: { days: 150, habitId: 'h1' },
      totalCheckIns: 1200,
    })

    expect(res.badges.every((b) => b.unlocked)).toBe(true)
    expect(res.badges.every((b) => b.progress === 1)).toBe(true)
    expect(res.nextStreakBadge).toBeNull()
    expect(res.nextCheckinBadge).toBeNull()
    expect(res.nextLocked.streak).toBeNull()
    expect(res.nextLocked.checkins).toBeNull()
  })
})
