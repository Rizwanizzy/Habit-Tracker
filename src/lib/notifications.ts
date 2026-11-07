/**
 * Browser notification and Web Push capability detection and permission utilities.
 * Pure logic and browser API wrappers for Web Push foundation.
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * Chromium/WebKit support `renotify: true` alongside `tag` at runtime, but TS 6.0's
 * DOM lib doesn't declare it on NotificationOptions — extend locally.
 */
type NotificationOptionsWithRenotify = NotificationOptions & { renotify?: boolean }

/** Result of attempting to display a local test notification. */
export interface LocalTestNotificationResult {
  /** True when a notification was handed to the browser successfully. */
  ok: boolean
  /**
   * Which display path succeeded (or was attempted last, when ok is false):
   * an active service worker registration or the legacy Notification constructor.
   * null when nothing was attempted (no permission / no API).
   */
  via: 'service-worker' | 'notification-api' | null
  /** Human-readable error message when ok is false; null on success. Never swallowed. */
  error: string | null
}

export interface PushNotificationCapabilities {
  /** True if window.Notification is available. */
  hasNotificationSupport: boolean
  /** True if navigator.serviceWorker is available. */
  hasServiceWorkerSupport: boolean
  /** True if window.PushManager is available. */
  hasPushManagerSupport: boolean
  /** True if all necessary APIs (Notification, ServiceWorker, PushManager) exist. */
  isSupported: boolean
  /** Current permission status ('default' | 'granted' | 'denied' | 'unsupported'). */
  permission: NotificationPermissionState
  /** True if the app is currently running in standalone display mode (installed PWA). */
  isStandalone: boolean
  /** True if the platform is iOS / iPadOS. */
  isIOS: boolean
  /**
   * On iOS / iPadOS 16.4+, Web Push is ONLY supported when running as an installed Home Screen PWA.
   * If true, user must add app to Home Screen before Push notifications can work.
   */
  requiresPWAInstall: boolean
}

/**
 * Detect current browser notification and Web Push capabilities.
 * Safe to call in any context (browser, SSR, iframe).
 * Never triggers permission prompts.
 */
export function getPushCapabilities(): PushNotificationCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasNotificationSupport: false,
      hasServiceWorkerSupport: false,
      hasPushManagerSupport: false,
      isSupported: false,
      permission: 'unsupported',
      isStandalone: false,
      isIOS: false,
      requiresPWAInstall: false,
    }
  }

  const hasNotificationSupport = 'Notification' in window
  const hasServiceWorkerSupport = 'serviceWorker' in navigator
  const hasPushManagerSupport = 'PushManager' in window

  const isSupported = hasNotificationSupport && hasServiceWorkerSupport && hasPushManagerSupport

  let permission: NotificationPermissionState = 'unsupported'
  if (hasNotificationSupport) {
    permission = Notification.permission as NotificationPermissionState
  }

  // Detect standalone mode (already installed PWA)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  // Detect iOS / iPadOS device
  const ua = (navigator.userAgent || '').toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // On iOS, Web Push is only supported if installed to Home Screen (standalone mode)
  const requiresPWAInstall = isIOS && !isStandalone

  return {
    hasNotificationSupport,
    hasServiceWorkerSupport,
    hasPushManagerSupport,
    isSupported,
    permission,
    isStandalone,
    isIOS,
    requiresPWAInstall,
  }
}

/**
 * Request notification permission from the user.
 * MUST only be invoked in response to a direct user action (e.g. clicking a button).
 * Does not repeatedly prompt users if permission is already 'granted' or 'denied'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  const current = Notification.permission
  if (current === 'granted' || current === 'denied') {
    return current as NotificationPermissionState
  }

  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermissionState
  } catch (err) {
    console.error('Notification permission request failed:', err)
    return 'denied'
  }
}

/**
 * Convert a base64 / URL-safe base64 string (such as a VAPID Public Key)
 * into a Uint8Array suitable for PushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Show a local test notification via the active service worker registration
 * (required on mobile & iOS, and the path that routes taps through the
 * push/notificationclick service worker handlers) or, when no registration is
 * active, the legacy `new Notification()` constructor.
 *
 * NEVER uses `navigator.serviceWorker.ready` — that promise pends FOREVER when
 * no service worker is registered (the exact bug: dev setups without a dev SW
 * made this function hang silently). `getRegistration()` resolves immediately.
 *
 * Returns a structured result with a human-readable error — never `false`
 * without explanation, never a swallowed error.
 */
export async function sendLocalTestNotification(
  title = 'Habit Tracker',
  options: NotificationOptions = {},
): Promise<LocalTestNotificationResult> {
  const failed = (error: string): LocalTestNotificationResult => ({ ok: false, via: null, error })

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[notifications] test: Notification API is not available in this context')
    return failed('This browser does not expose the Notification API.')
  }
  if (Notification.permission !== 'granted') {
    console.warn('[notifications] test skipped: permission is', Notification.permission)
    return failed(`Notification permission is "${Notification.permission}" — enable notifications first.`)
  }

  const notificationOptions: NotificationOptionsWithRenotify = {
    body: 'Notifications are working! You will receive daily habit reminders.',
    icon: '/icon-192.png',
    badge: '/pwa-64x64.png',
    tag: 'test-notification',
    // Chromium quirk: showing a notification with the same `tag` after its
    // previous incarnation was dismissed/clicked is treated as a QUIET
    // replacement — no new window/toast at all (works exactly once per session).
    // `renotify: true` (only valid together with `tag`) forces a fresh alert
    // every time the test button is clicked.
    renotify: true,
    ...options,
  }

  // Path A: active service worker registration (preferred).
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions)
        console.info('[notifications] test shown via ServiceWorkerRegistration.showNotification')
        return { ok: true, via: 'service-worker', error: null }
      }
      console.info('[notifications] test: no active service worker registration — using the Notification constructor')
    } catch (err) {
      console.warn('[notifications] test: service worker path failed; falling back to the Notification constructor:', err)
    }
  }

  // Path B: legacy constructor (works on desktop when permission is granted).
  try {
    new Notification(title, notificationOptions)
    console.info('[notifications] test shown via new Notification()')
    return { ok: true, via: 'notification-api', error: null }
  } catch (err) {
    console.error('[notifications] test notification failed:', err)
    return failed(describeNotificationError(err))
  }
}

/** Turn a thrown display error into an understandable, actionable message. */
function describeNotificationError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)
  switch (name) {
    case 'NotAllowedError':
      return 'The browser blocked this notification (NotAllowedError) — re-check the site notification permission in the browser settings.'
    case 'SecurityError':
      return 'The browser refused to show the notification outside a direct user action (SecurityError).'
    default:
      return `The browser failed to display the notification: ${message || 'unknown error'}`
  }
}
