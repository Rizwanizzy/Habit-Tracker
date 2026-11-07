import { useCallback, useEffect, useState } from 'react'
import {
  getPushCapabilities,
  requestNotificationPermission,
  sendLocalTestNotification,
  type PushNotificationCapabilities,
  type NotificationPermissionState,
} from '../lib/notifications'

export interface UseNotificationPermissionResult {
  capabilities: PushNotificationCapabilities
  isRequesting: boolean
  requestPermission: () => Promise<NotificationPermissionState>
  sendTest: () => Promise<boolean>
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

  const sendTest = useCallback(async (): Promise<boolean> => {
    return sendLocalTestNotification('Habit Tracker Reminder', {
      body: 'Time to check in on your habits today! (Test Notification)',
    })
  }, [])

  return {
    capabilities,
    isRequesting,
    requestPermission: request,
    sendTest,
    refresh,
  }
}
