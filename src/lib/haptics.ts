/** Tiny haptic helper for the phone wheel pickers: an 8 ms "tick" vibration.
 *  Android/iOS Chrome support navigator.vibrate; iOS Safari does not, so it
 *  silently does nothing there — no workaround (intentional). */

const MIN_GAP_MS = 40

let lastTick = 0

export function tick(): void {
  const now = Date.now()
  if (now - lastTick < MIN_GAP_MS) return
  lastTick = now
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8)
    }
  } catch {
    // Vibration can throw in some embedded contexts — never break the UI.
  }
}
