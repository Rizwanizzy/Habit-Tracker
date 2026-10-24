import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IconLogout, IconMoon, IconOverview, IconSettings, IconSun, IconToday, IconUser } from './icons'
import { useTheme } from '../hooks/useTheme'
import { getSupabase } from '../lib/supabase'
import type { ComponentType } from 'react'

type NavItem = { to: string; label: string; Icon: ComponentType<{ className?: string }> }

const NAV: NavItem[] = [
  { to: '/', label: 'Today', Icon: IconToday },
  { to: '/overview', label: 'Overview', Icon: IconOverview },
  { to: '/profile', label: 'Profile', Icon: IconUser },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

/** Rounded 48px circles used by the rail (DESIGN.md §5). */
const RAIL_CIRCLE =
  'grid size-12 place-items-center rounded-full transition-all duration-150 active:scale-95 '

/** App shell (DESIGN.md §5): floating rounded shell over the aurora background
 *  with a 72px icon rail on desktop; floating glass dock on mobile. */
export function AppShell() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function signOut() {
    setSignOutError(null)
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signOut()
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'Sign out failed')
    }
  }

  function railClass({ isActive }: { isActive: boolean }): string {
    return isActive
      ? `${RAIL_CIRCLE}bg-accent-gradient text-white glow-accent`
      : `${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-fg`
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] lg:p-4">
      <div className="glass-card flex min-h-dvh overflow-hidden lg:rounded-shell lg:min-h-[calc(100dvh-2rem)]">
        {/* Desktop rail: 72px wide column of circular icon buttons */}
        <aside aria-label="Primary" className="hidden w-[72px] shrink-0 flex-col items-center border-r border-border py-5 lg:flex">
          <nav className="flex flex-col items-center gap-3">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} aria-label={label} title={label} className={railClass}>
                <Icon className="size-5" />
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
              className={`${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-fg`}
            >
              {dark ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className={`${RAIL_CIRCLE}bg-surface-raised text-fg-secondary hover:text-danger`}
            >
              <IconLogout className="size-5" />
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile dock: floating glass pill, 64px high, 16px inset, safe-area aware */}
      <nav
        aria-label="Primary"
        className="glass-pill fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex h-16 items-center justify-center gap-2 rounded-pill px-3 lg:hidden"
      >
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex size-11 place-items-center rounded-pill transition-all duration-150 active:scale-95 ${
                isActive ? 'bg-accent-gradient text-white glow-accent' : 'text-fg-secondary'
              }`
            }
          >
            <Icon className="size-5" />
            <span className="sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Visible sign-out error — never swallowed. */}
      {signOutError && (
        <p role="alert" className="text-caption fixed bottom-24 left-4 z-40 max-w-[90vw] rounded-pill bg-danger/10 px-3 py-2 text-danger lg:bottom-6">
          {signOutError}
        </p>
      )}
    </div>
  )
}
