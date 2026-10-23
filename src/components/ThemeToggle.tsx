import { useTheme } from '../hooks/useTheme'
import { IconMoon, IconSun } from './icons'

/** Toggles the .dark class on <html> and persists the choice. */
export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-11 items-center gap-2 rounded-button border border-border bg-surface px-3 text-body font-medium text-fg-secondary hover:bg-surface-raised"
    >
      {dark ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
      {dark ? 'Light theme' : 'Dark theme'}
    </button>
  )
}