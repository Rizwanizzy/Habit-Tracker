import { useEffect, useState } from 'react'
import type { ResolvedTheme } from './useTheme'
import { getStoredTheme, getSystemDark, resolveTheme } from './useTheme'

/** Reactive resolved theme name (e.g. 'dark', 'light', 'sepia', 'oled', 'solarized-light', 'solarized-dark', 'high-contrast'),
 *  synced with the event that useTheme dispatches. Purely presentational — no data or auth logic. */
export function useThemeName(): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr) return attr as ResolvedTheme
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    return 'dark'
  })

  useEffect(() => {
    const sync = () => {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr) {
        setResolved(attr as ResolvedTheme)
      } else {
        const stored = getStoredTheme()
        setResolved(resolveTheme(stored, getSystemDark()))
      }
    }
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

  return resolved
}
