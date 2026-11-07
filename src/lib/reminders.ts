/**
 * Pass 2 daily-reminder pure helpers and DB row types:
 * VAPID public key lookup, push-subscription payload extraction,
 * device labeling, and reminder-time normalization.
 *
 * Pure logic + data shapes only — no React, no Supabase client, no browser
 * push calls (the subscribe/unsubscribe flow lives in the hook).
 */

/** `notification_settings` row shape (Supabase). */
export interface NotificationSettingsRow {
  user_id: string
  reminder_enabled: boolean
  /** Postgres `time` — normalized to 'HH:MM' when written by the app. */
  reminder_time: string
  timezone: string
  created_at?: string
  updated_at?: string
}

/** `push_subscriptions` row shape (Supabase). */
export interface PushSubscriptionRow {
  id?: string
  user_id: string
  /** Globally unique — ON CONFLICT (endpoint) makes device re-subscribe an upsert. */
  endpoint: string
  p256dh: string
  auth: string
  device_label: string | null
  user_agent: string | null
  created_at?: string
  updated_at?: string
  last_seen_at?: string
}

/** Defaults matching the DB schema (notification_settings). */
export const DEFAULT_REMINDER_TIME = '20:00'
export const DEFAULT_TIMEZONE = 'Asia/Kolkata'
export const VAPID_KEY_ENV = 'VITE_VAPID_PUBLIC_KEY'

/**
 * Read the application server public key from Vite env vars.
 * Returns null (never throws) when the variable is missing/blank so the UI can
 * show an actionable message. The PRIVATE key must never live in the frontend.
 */
export function getVapidPublicKey(env: unknown = import.meta.env): string | null {
  const raw = env && typeof env === 'object'
    ? (env as Record<string, unknown>)[VAPID_KEY_ENV]
    : undefined
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  return raw.trim()
}

/** Timezone-stable reminder time when the user leaves the control empty. */
export function reminderTimeOr(settings: NotificationSettingsRow | null): string {
  return normalizeReminderTime(settings?.reminder_time) ?? DEFAULT_REMINDER_TIME
}

/**
 * Extract the fields the `push_subscriptions` upsert needs from a browser
 * PushSubscription. Accepts the subscription's own toJSON() output:
 * `{ endpoint, keys: { p256dh, auth }, ... }`. Returns null on anything
 * malformed so the caller can show a clear error instead of a 400-ish DB one.
 */
export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export function extractSubscriptionPayload(json: unknown): PushSubscriptionKeys | null {
  if (!json || typeof json !== 'object') return null
  const { endpoint, keys } = json as { endpoint?: unknown; keys?: unknown }
  if (typeof endpoint !== 'string' || endpoint.trim().length === 0) return null
  if (!keys || typeof keys !== 'object') return null
  const { p256dh, auth } = keys as Record<string, unknown>
  if (typeof p256dh !== 'string' || p256dh.trim().length === 0) return null
  if (typeof auth !== 'string' || auth.trim().length === 0) return null
  return { endpoint: endpoint.trim(), p256dh, auth }
}

/**
 * Normalize a Postgres `time` or an `<input type="time">` value
 * ('H:MM', 'HH:MM', 'HH:MM:SS') to canonical 'HH:MM', or null when invalid.
 */
export function normalizeReminderTime(value: string | null | undefined): string | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const sec = m[3] === undefined ? 0 : Number(m[3])
  if (h > 23 || min > 59 || sec > 59 || m[2].length !== 2) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/**
 * Human label for a device from its user agent, e.g. "Chrome on Windows".
 * Order matters: Chromium-based UAs also contain "Safari", and the iOS
 * browsers (crios/fxios/edgios) spoof the platform tokens.
 */
export function describeDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase()

  const browser = /edg(?:e|a|ios)?\//.test(ua) ? 'Edge'
    : /crios\//.test(ua) ? 'Chrome'
    : /chrome\//.test(ua) ? 'Chrome'
    : /fxios\/|firefox\//.test(ua) ? 'Firefox'
    : /safari/.test(ua) ? 'Safari'
    : 'Browser'

  const os = /\bipad\b/.test(ua) ? 'iPad'
    : /\biphone\b/.test(ua) ? 'iPhone'
    : /android/.test(ua) ? 'Android'
    : /mac os|macintosh/.test(ua) ? 'macOS'
    : /windows/.test(ua) ? 'Windows'
    : 'Device'

  return `${browser} on ${os}`
}
