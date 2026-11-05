import { useSyncExternalStore } from 'react'

/** SSR-safe, flash-free media query hook using useSyncExternalStore. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {}
      const mql = window.matchMedia(query)
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
      } else {
        // Fallback for older browsers
        const legacyMql = mql as MediaQueryList & {
          addListener?: (cb: (e: MediaQueryListEvent) => void) => void
          removeListener?: (cb: (e: MediaQueryListEvent) => void) => void
        }
        legacyMql.addListener?.(onChange)
        return () => legacyMql.removeListener?.(onChange)
      }
    },
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false,
  )
}
