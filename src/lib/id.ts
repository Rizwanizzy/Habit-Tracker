/** Generate a UUID v4 for optimistic temp rows and import retries.
 *
 * `crypto.randomUUID()` is only available in SECURE contexts, so a bare
 * call throws on the LAN dev origin (`http://192.168.x.x:5173`) — the way
 * phones are tested — and on any insecure origin. This helper falls back
 * to a `crypto.getRandomValues` v4 generator so the app keeps working there
 * instead of throwing into the hook's await chain. Pure, no React/Supabase. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}