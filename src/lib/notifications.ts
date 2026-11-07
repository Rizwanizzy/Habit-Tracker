/**
 * Browser notification and Web Push capability detection and permission utilities.
 * Pure logic and browser API wrappers for Web Push foundation.
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

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
 * Show a local test notification via the active service worker registration or Notification constructor.
 * Useful for verifying permission and display support.
 */
export async function sendLocalTestNotification(
  title = 'Habit Tracker',
  options: NotificationOptions = {},
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false
  }

  const notificationOptions: NotificationOptions = {
    body: 'Notifications are working! You will receive daily habit reminders.',
    icon: '/icon-192.png',
    badge: '/pwa-64x64.png',
    tag: 'test-notification',
    ...options,
  }

  try {
    // Prefer service worker registration showNotification (required on mobile & iOS)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions)
        return true
      }
    }

    // Fallback for desktop browsers without active SW
    new Notification(title, notificationOptions)
    return true
  } catch (err) {
    console.error('Failed to display test notification:', err)
    return false
  }
}
