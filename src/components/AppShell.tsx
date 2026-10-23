import { NavLink, Outlet } from 'react-router-dom'
import { IconOverview, IconSettings, IconToday } from './icons'
import type { ComponentType } from 'react'

type NavItem = { to: string; label: string; Icon: ComponentType<{ className?: string }> }

const NAV: NavItem[] = [
  { to: '/', label: 'Today', Icon: IconToday },
  { to: '/overview', label: 'Overview', Icon: IconOverview },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

/** App chrome: fixed bottom nav on mobile, sidebar on desktop. Content in between. */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-fg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-border bg-surface p-4 md:flex">
        <h1 className="text-section-title px-2">Habit Tracker</h1>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-button px-3 text-body font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-surface-raised text-accent'
                    : 'text-fg-secondary hover:bg-surface-raised hover:text-fg'
                }`
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="px-4 pt-5 pb-28 md:pb-10 md:pl-60">
        <div className="mx-auto w-full max-w-3xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex h-[72px] border-t border-border bg-surface md:hidden">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150 ${
                isActive ? 'text-accent' : 'text-fg-muted'
              }`
            }
          >
            <Icon className="size-6" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}