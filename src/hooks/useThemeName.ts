import { useEffect, useState } from 'react'

/** Reactive theme name ('dark' | 'light'), synced with the event that
 *  useTheme dispatches. Purely presentational — no data or auth logic. */
export function useThemeName(): 'dark' | 'light' {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

  return dark ? 'dark' : 'light'
}
