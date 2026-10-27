import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useProfileContext } from '../contexts/ProfileContext'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { now } from '../lib/clock'
import { parseLocalDate } from '../lib/dates'
import { initialsFrom } from '../lib/profile'

/** Switch to false to show the full name instead of just the first word. */
const SHOW_FIRST_NAME_ONLY = true

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function getGreeting(): string {
  // REAL CLOCK: the greeting is about the actual time of day (read through
  // clock.now() so dev time-travel affects it too).
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now()).find((p) => p.type === 'hour')?.value
  const h = hour ? Number(hour) : 0
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function getDisplayName(fullName: string | null, email: string | null): string {
  const source = (fullName ?? '').trim() || (email ?? '').split('@')[0]?.trim() || 'there'
  const words = source.split(/\s+/).filter(Boolean)
  if (SHOW_FIRST_NAME_ONLY) return words[0] ?? 'there'
  return source
}

export function TodayGreeting() {
  const { profile, loading, email, avatarUrl } = useProfileContext()
  // Date caption under the greeting: the LOGICAL day (day-start aware), so
  // after midnight with a later day start it still shows the previous day.
  const today = useLogicalToday()

  const name = profile ? getDisplayName(profile.full_name, email) : 'there'
  const greeting = loading ? '' : getGreeting()
  const date = useMemo(() => DATE_FMT.format(parseLocalDate(today)), [today])

  const hasPhoto = avatarUrl != null && profile?.avatar_path != null
  const initials = initialsFrom(profile?.full_name ?? null, email)

  return (
    <div className="flex items-center gap-3 min-w-0">
      <Link
        to="/profile"
        onClick={(e) => {
          if (loading) e.preventDefault()
        }}
        className="relative shrink-0"
      >
        <div className="relative">
          {hasPhoto ? (
            <img
              src={avatarUrl!}
              alt="Profile"
              className="size-[48px] rounded-full object-cover ring-4 ring-background"
              loading="lazy"
            />
          ) : (
            <div
              aria-hidden="true"
              className="bg-accent-gradient glow-accent grid size-[48px] place-items-center rounded-full ring-4 ring-background"
            >
              <span className="text-stat text-white">{initials}</span>
            </div>
          )}
          <span
            aria-hidden="true"
            className="glow-accent pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 45%, transparent)' }}
          />
        </div>
      </Link>
      <div className="min-w-0">
        <p className="text-caption text-fg-muted">{greeting}</p>
        <h1 className="text-page-title min-w-0 truncate leading-none">
          Hi, {name}
        </h1>
        <p className="text-caption mt-1 text-fg-muted">{date}</p>
      </div>
    </div>
  )
}
