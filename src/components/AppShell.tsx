import { Link, NavLink, Outlet } from 'react-router-dom'
import { IconHome, IconOverview, IconPlus, IconSettings, IconToday, IconUser } from './icons'
import { useProfileContext } from '../contexts/ProfileContext'
import type { ComponentType } from 'react'

type NavItem = {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Shown in the desktop rail (Today lives in the logo link there). */
  rail?: boolean
  /** Shown in the mobile dock — 'left' | 'right' side of the center FAB. */
  dock?: 'left' | 'right'
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', Icon: IconToday, dock: 'left' },
  { to: '/overview', label: 'Overview', Icon: IconOverview, rail: true, dock: 'left' },
  { to: '/settings', label: 'Settings', Icon: IconSettings, rail: true, dock: 'right' },
  { to: '/profile', label: 'Profile', Icon: IconUser, dock: 'right' },
]

/** Rounded 48px circles used by the rail (DESIGN.md §5). */
const RAIL_CIRCLE =
  'grid size-12 place-items-center rounded-full transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none '

/** App shell (DESIGN.md §5): floating rounded shell over the aurora background
 *  with a 72px icon rail on desktop; floating glass dock on mobile. */
export function AppShell() {
  const { profile, avatarUrl } = useProfileContext()

  function railClass({ isActive }: { isActive: boolean }): string {
    return isActive
      ? `${RAIL_CIRCLE}bg-accent-gradient text-white glow-accent`
      : `${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-fg`
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] lg:p-4">
      <div className="glass-card app-shell flex min-h-dvh overflow-hidden lg:rounded-shell lg:min-h-[calc(100dvh-2rem)]">
        {/* Desktop rail: 72px wide column */}
        <aside aria-label="Primary" className="hidden w-[72px] shrink-0 flex-col items-center border-r border-border py-5 lg:flex">
          {/* Top: logo mark (no border/background, matches Sign in page) */}
          <Link
            to="/"
            className="mb-6 inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Go to Today"
          >
            <img
              src="/logo.png"
              alt="Habit Tracker"
              className="size-[56px]"
              aria-hidden="true"
            />
          </Link>
          <nav className="flex flex-col items-center gap-3">
            {/* NavLink supplies isActive itself — reactive on every navigation. */}
            {NAV.filter(({ rail }) => rail).map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                aria-label={label}
                title={label}
                className={railClass}
              >
                <Icon className="size-5" />
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            {/* Profile avatar button (48px, accent ring when /profile is open) */}
            <NavLink
              to="/profile"
              aria-label="Profile"
              title="Profile"
              className={({ isActive }) =>
                `relative inline-flex shrink-0 rounded-full transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? 'ring-2 ring-accent' : ''
                }`
              }
            >
              <div className="grid size-12 place-items-center rounded-full bg-surface-raised border border-border hover:bg-surface hover:text-fg transition-colors duration-150">
                {avatarUrl && profile?.avatar_path ? (
                  <img src={avatarUrl} alt="Profile" className="size-[40px] rounded-full object-cover" />
                ) : (
                  <IconUser className="size-5" />
                )}
              </div>
            </NavLink>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile dock: floating glass pill with center FAB (Add habit).
          Left items: Today, Overview. Right items: Settings, Profile. */}
      <nav
        aria-label="Primary"
        className="glass-pill mobile-dock fixed inset-x-4 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 flex h-16 items-center justify-between rounded-pill px-3 lg:hidden"
      >
        {NAV.filter(({ dock }) => dock === 'left').map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex w-11 h-11 justify-center items-center rounded-pill transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive ? 'bg-accent-gradient text-white glow-accent' : 'text-fg-secondary'
              }`
            }
          >
            {/* The dock's Today slot is the app's home — use a home glyph
                instead of `IconToday` (a sun-like icon), so the dock reads
                as a home button. The desktop rail keeps IconToday. */}
            {to === '/' ? <IconHome className="size-5" /> : <Icon className="size-5" />}
            <span className="sr-only">{label}</span>
          </NavLink>
        ))}

        {/* Center FAB: Add habit (always visible on mobile). */}
        <Link
          to="/habits/new"
          aria-label="Add habit"
          className="bg-accent-gradient glow-accent grid size-14 shrink-0 place-items-center rounded-full text-white transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <IconPlus className="size-6" />
        </Link>

        {NAV.filter(({ dock }) => dock === 'right').map(({ to, label, Icon: IconComp }) => {
          const isProfile = to === '/profile'
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex w-11 h-11 justify-center items-center rounded-pill transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? 'bg-accent-gradient text-white glow-accent' : 'text-fg-secondary'
                }`
              }
            >
              {isProfile && avatarUrl && profile?.avatar_path ? (
                <img src={avatarUrl} alt="Profile" className="size-[32px] rounded-full object-cover" />
              ) : (
                <IconComp className="size-5" />
              )}
              <span className="sr-only">{label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
