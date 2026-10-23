import { useEffect, useState } from 'react'

function applyDark(next: boolean) {
  document.documentElement.classList.toggle('dark', next)
  window.dispatchEvent(new Event('themechange'))
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    applyDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return { dark, toggle }
}