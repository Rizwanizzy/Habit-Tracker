/** The app's single time source.
 *
 *  In dev builds (import.meta.env.DEV) it honours localStorage['dev-now'] — an
 *  ISO instant string, validated on read; invalid values are ignored — so the
 *  UI can be time-travelled while testing (check the after-midnight case
 *  without waiting for after midnight). Set e.g.
 *  localStorage.setItem('dev-now', '2026-10-28T01:30:00+05:30') and reload.
 *
 *  Production builds always use the real clock, so a stray dev value can
 *  never leak into a deployed app. */
export function now(): Date {
  if (import.meta.env.DEV) {
    try {
      const raw = localStorage.getItem('dev-now')
      if (raw) {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) return d
      }
    } catch {
      // Storage unavailable — fall through to the real clock.
    }
  }
  return new Date()
}
