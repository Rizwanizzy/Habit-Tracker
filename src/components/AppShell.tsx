import { Link, NavLink, Outlet } from 'react-router-dom'
import { IconMoon, IconOverview, IconSettings, IconSun, IconToday, IconUser } from './icons'
import { useTheme } from '../hooks/useTheme'
import { useProfileContext } from '../contexts/ProfileContext'
import type { ComponentType } from 'react'

type NavItem = {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Shown in the desktop rail (Today lives in the logo link there). */
  rail?: boolean
  /** Shown in the mobile dock (all three, per DESIGN.md §5/§11). */
  dock?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', Icon: IconToday, dock: true },
  { to: '/overview', label: 'Overview', Icon: IconOverview, rail: true, dock: true },
  { to: '/settings', label: 'Settings', Icon: IconSettings, rail: true, dock: true },
]

/** Rounded 48px circles used by the rail (DESIGN.md §5). */
const RAIL_CIRCLE =
  'grid size-12 place-items-center rounded-full transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none '

/** App shell (DESIGN.md §5): floating rounded shell over the aurora background
 *  with a 72px icon rail on desktop; floating glass dock on mobile. */
export function AppShell() {
  const { dark, toggle } = useTheme()
  const { profile, avatarUrl } = useProfileContext()

  function railClass({ isActive }: { isActive: boolean }): string {
    return isActive
      ? `${RAIL_CIRCLE}bg-accent-gradient text-white glow-accent`
      : `${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-fg`
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] lg:p-4">
      <div className="glass-card flex min-h-dvh overflow-hidden lg:rounded-shell lg:min-h-[calc(100dvh-2rem)]">
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
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
              className={`${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-fg`}
            >
              {dark ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile dock: floating glass pill, 64px high, 16px inset, safe-area aware.
          3 items (Today, Overview, Settings) — Today uses end so "/" alone matches. */}
      <nav
        aria-label="Primary"
        className="glass-pill fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex h-16 items-center justify-center gap-2 rounded-pill px-3 lg:hidden"
      >
        {NAV.filter(({ dock }) => dock).map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex size-11 place-items-center rounded-pill transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive ? 'bg-accent-gradient text-white glow-accent' : 'text-fg-secondary'
              }`
            }
          >
            <Icon className="size-5" />
            <span className="sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
