import { useEffect, useState } from 'react'

export type Theme =
  | 'system'
  | 'light'
  | 'dark'
  | 'sepia'
  | 'oled'
  | 'solarized'
  | 'high-contrast'

export type ResolvedTheme =
  | 'light'
  | 'dark'
  | 'sepia'
  | 'oled'
  | 'solarized-light'
  | 'solarized-dark'
  | 'high-contrast'

export const VALID_THEMES: readonly Theme[] = [
  'system',
  'light',
  'dark',
  'sepia',
  'oled',
  'solarized',
  'high-contrast',
] as const

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (VALID_THEMES as readonly string[]).includes(value)
}

/** Returns true for themes with dark backgrounds and light foregrounds. */
export function isDarkTheme(theme: ResolvedTheme | Theme): boolean {
  return (
    theme === 'dark' ||
    theme === 'oled' ||
    theme === 'solarized-dark' ||
    theme === 'high-contrast'
  )
}

/** Resolves the user selection (including 'system' and 'solarized') against the OS appearance. */
export function resolveTheme(theme: Theme, isSystemDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return isSystemDark ? 'dark' : 'light'
  }
  if (theme === 'solarized') {
    return isSystemDark ? 'solarized-dark' : 'solarized-light'
  }
  return theme
}

export function getSystemDark(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = localStorage.getItem('theme')
    if (raw && isTheme(raw)) return raw
    return 'system'
  } catch {
    return 'system'
  }
}

/** Primary background color for the browser theme-color meta tag. */
export function getThemeMetaColor(resolved: ResolvedTheme): string {
  switch (resolved) {
    case 'light':
      return '#E6EEF8'
    case 'sepia':
      return '#F5EEE6'
    case 'oled':
    case 'high-contrast':
      return '#000000'
    case 'solarized-light':
      return '#FDF6E3'
    case 'solarized-dark':
      return '#002B36'
    case 'dark':
    default:
      return '#070A12'
  }
}

/** Applies classes, data attributes, color-scheme, and meta tags to the DOM. */
export function applyTheme(selected: Theme) {
  if (typeof document === 'undefined') return
  const isSystemDark = getSystemDark()
  const resolved = resolveTheme(selected, isSystemDark)
  const isDark = isDarkTheme(resolved)

  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.setAttribute('data-theme', resolved)
  root.setAttribute('data-selected-theme', selected)
  root.style.colorScheme = isDark ? 'dark' : 'light'

  // Update theme-color meta tag for mobile browsers and PWA standalone windows
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', getThemeMetaColor(resolved))
  }

  window.dispatchEvent(
    new CustomEvent('themechange', {
      detail: { selected, resolved, isDark },
    }),
  )
}

export function useTheme() {
  const [theme, setSelectedThemeState] = useState<Theme>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-selected-theme')
      if (attr && isTheme(attr)) return attr
    }
    return getStoredTheme()
  })

  const [resolvedTheme, setResolvedThemeState] = useState<ResolvedTheme>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr) return attr as ResolvedTheme
    }
    return resolveTheme(theme, getSystemDark())
  })

  useEffect(() => {
    const sync = () => {
      const stored = getStoredTheme()
      const isSystemDark = getSystemDark()
      const resolved = resolveTheme(stored, isSystemDark)
      setSelectedThemeState(stored)
      setResolvedThemeState(resolved)
    }

    window.addEventListener('themechange', sync)

    let media: MediaQueryList | null = null
    const onMediaChange = () => {
      const stored = getStoredTheme()
      if (stored === 'system' || stored === 'solarized') {
        applyTheme(stored)
      }
      sync()
    }

    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', onMediaChange)
    } catch {}

    return () => {
      window.removeEventListener('themechange', sync)
      media?.removeEventListener('change', onMediaChange)
    }
  }, [])

  function setTheme(next: Theme) {
    try {
      localStorage.setItem('theme', next)
    } catch {}
    applyTheme(next)
    setSelectedThemeState(next)
    setResolvedThemeState(resolveTheme(next, getSystemDark()))
  }

  const dark = isDarkTheme(resolvedTheme)

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark'
    setTheme(next)
  }

  return {
    theme,
    resolvedTheme,
    setTheme,
    dark,
    toggle,
  }
}