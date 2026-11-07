import { useCallback, useEffect, useState } from 'react'
import {
  getPushCapabilities,
  requestNotificationPermission,
  sendLocalTestNotification,
  type PushNotificationCapabilities,
  type NotificationPermissionState,
  type LocalTestNotificationResult,
} from '../lib/notifications'

export interface UseNotificationPermissionResult {
  capabilities: PushNotificationCapabilities
  isRequesting: boolean
  requestPermission: () => Promise<NotificationPermissionState>
  sendTest: () => Promise<LocalTestNotificationResult>
  refresh: () => void
}

/**
 * Hook to inspect Web Push capabilities and request notification permission
 * via explicit user actions.
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [capabilities, setCapabilities] = useState<PushNotificationCapabilities>(() => getPushCapabilities())
  const [isRequesting, setIsRequesting] = useState(false)

  const refresh = useCallback(() => {
    setCapabilities(getPushCapabilities())
  }, [])

  useEffect(() => {
    refresh()

    // Re-check permissions when returning to the tab (user may change settings in browser)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const request = useCallback(async (): Promise<NotificationPermissionState> => {
    setIsRequesting(true)
    try {
      const result = await requestNotificationPermission()
      setCapabilities(getPushCapabilities())
      return result
    } finally {
      setIsRequesting(false)
    }
  }, [])

  const sendTest = useCallback(async (): Promise<LocalTestNotificationResult> => {
    try {
      return await sendLocalTestNotification('Habit Tracker Reminder', {
        body: 'Time to check in on your habits today! (Test Notification)',
      })
    } catch (err) {
      // sendLocalTestNotification resolves with structured errors instead of
      // throwing, so reaching here means something truly unexpected happened —
      // surface it, never swallow it.
      console.error('[notifications] sendTest crashed unexpectedly:', err)
      return {
        ok: false,
        via: null,
        error: `Test notification crashed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }, [])

  return {
    capabilities,
    isRequesting,
    requestPermission: request,
    sendTest,
    refresh,
  }
}
