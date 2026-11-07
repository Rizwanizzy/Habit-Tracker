import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import { urlBase64ToUint8Array } from '../lib/notifications'
import {
  DEFAULT_REMINDER_TIME,
  DEFAULT_TIMEZONE,
  describeDevice,
  extractSubscriptionPayload,
  getVapidPublicKey,
  normalizeReminderTime,
  type NotificationSettingsRow,
  type PushSubscriptionRow,
} from '../lib/reminders'

/** The push_subscriptions/notification_settings tables as a hook: load on
 *  mount, plus optimistic save/subscribe/unsubscribe with snapshot rollback.
 *  Errors are EXPOSED via `error` (string), never thrown — the UI shows them
 *  next to the controls (useVacations pattern). */
export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettingsRow | null>(null)
  const [devices, setDevices] = useState<PushSubscriptionRow[]>([])
  /** Push endpoint of THIS browser, when it holds a live PushSubscription. */
  const [deviceEndpoint, setDeviceEndpoint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (cancelled) return
      if (userError || !userData.user) {
        setError(userError?.message ?? 'You must be signed in to manage reminders')
        setLoading(false)
        return
      }
      const [settingsRes, devicesRes, endpoint] = await Promise.all([
        sb.from('notification_settings').select('*').limit(1),
        sb.from('push_subscriptions').select('*').order('created_at'),
        currentDeviceEndpoint(),
      ])
      if (cancelled) return
      if (settingsRes.error) setError(settingsRes.error.message)
      else setSettings((settingsRes.data as NotificationSettingsRow[])[0] ?? null)
      if (devicesRes.error) setError(devicesRes.error.message)
      else setDevices(devicesRes.data as PushSubscriptionRow[])
      setDeviceEndpoint(endpoint)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  /** Upsert the one reminder-preferences row (created on first save). */
  const saveSettings = useCallback(
    async (reminderEnabled: boolean, reminderTime: string): Promise<boolean> => {
      const sb = getSupabase()
      const { data: userData, error: userError } = await sb.auth.getUser()
      if (userError || !userData.user) {
        setError('You must be signed in to manage reminders')
        return false
      }
      const time = normalizeReminderTime(reminderTime) ?? DEFAULT_REMINDER_TIME
      const snapshot = settings
      const base: NotificationSettingsRow = settings ?? {
        user_id: userData.user.id,
        reminder_enabled: false,
        reminder_time: time,
        timezone: DEFAULT_TIMEZONE,
      }
      setSettings({ ...base, reminder_enabled: reminderEnabled, reminder_time: time })
      const { data, error: dbError } = await sb
        .from('notification_settings')
        .upsert(
          {
            user_id: base.user_id,
            reminder_enabled: reminderEnabled,
            reminder_time: time,
            timezone: base.timezone,
          },
          { onConflict: 'user_id' },
        )
        .select('*')
        .single()
      if (dbError) {
        setSettings(snapshot)
        setError(dbError.message)
        return false
      }
      setSettings(data as NotificationSettingsRow)
      setError(null)
      return true
    },
    [settings],
  )

  /** Subscribe THIS browser: PushManager → push_subscriptions upsert
   *  (endpoint UNIQUE makes a re-subscribe an upsert, never a duplicate). */
  const subscribeThisDevice = useCallback(async (): Promise<boolean> => {
    const sb = getSupabase()
    const { data: userData, error: userError } = await sb.auth.getUser()
    if (userError || !userData.user) {
      setError('You must be signed in to enable this device')
      return false
    }
    const key = getVapidPublicKey()
    if (!key) {
      setError('Missing VITE_VAPID_PUBLIC_KEY in the build environment — cannot subscribe.')
      return false
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('This browser does not support push subscriptions.')
      return false
    }
    try {
      const reg = await getActiveRegistration()
      if (!reg) {
        setError('No active service worker yet — reload the page and try again.')
        return false
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
      const payload = extractSubscriptionPayload(sub.toJSON())
      if (!payload) {
        await sub.unsubscribe().catch(() => undefined)
        setError('Could not read the push subscription keys from this browser.')
        return false
      }
      const device_label = describeDevice(navigator.userAgent)
      const user_agent = navigator.userAgent
      const devicesSnapshot = devices
      const endpointSnapshot = deviceEndpoint
      const endpoint = payload.endpoint
      setDevices((prev) => [
        ...prev.filter((d) => d.endpoint !== endpoint),
        { user_id: userData.user.id, ...payload, device_label, user_agent },
      ])
      setDeviceEndpoint(endpoint)
      const { data, error: dbError } = await sb
        .from('push_subscriptions')
        .upsert({ user_id: userData.user.id, ...payload, device_label, user_agent }, { onConflict: 'endpoint' })
        .select('*')
        .single()
      if (dbError) {
        setDevices(devicesSnapshot)
        setDeviceEndpoint(endpointSnapshot)
        setError(dbError.message)
        return false
      }
      setDevices((prev) => [...prev.filter((d) => d.endpoint !== endpoint), data as PushSubscriptionRow])
      setError(null)
      return true
    } catch (err) {
      setError(describePushError(err))
      return false
    }
  }, [devices, deviceEndpoint])

  /** Unsubscribe THIS browser: remove the row, then release the subscription. */
  const unsubscribeThisDevice = useCallback(async (): Promise<boolean> => {
    const sb = getSupabase()
    if (!('serviceWorker' in navigator)) {
      setError('This browser does not support push subscriptions.')
      return false
    }
    try {
      const reg = await getActiveRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (!reg || !sub) {
        setError('This device is not registered for reminders.')
        return false
      }
      const endpoint = sub.endpoint
      const devicesSnapshot = devices
      const endpointSnapshot = deviceEndpoint
      setDevices((prev) => prev.filter((d) => d.endpoint !== endpoint))
      setDeviceEndpoint(null)
      const { error: dbError } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
      if (dbError) {
        setDevices(devicesSnapshot)
        setDeviceEndpoint(endpointSnapshot)
        setError(dbError.message)
        return false
      }
      await sub.unsubscribe().catch(() => undefined)
      setError(null)
      return true
    } catch (err) {
      setError(describePushError(err))
      return false
    }
  }, [devices, deviceEndpoint])

  return {
    settings,
    devices,
    /** True when this browser has a live push subscription AND a row for it. */
    subscribedThisDevice: deviceEndpoint !== null && devices.some((d) => d.endpoint === deviceEndpoint),
    /** Push endpoint of this browser, or null. */
    deviceEndpoint,
    loading,
    error,
    saveSettings,
    subscribeThisDevice,
    unsubscribeThisDevice,
  }
}

export type UseNotificationSettingsResult = ReturnType<typeof useNotificationSettings>

/** Push endpoint of the active PushSubscription in THIS browser, if any. */
async function currentDeviceEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const reg = await getActiveRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub?.endpoint ?? null
  } catch {
    return null
  }
}

/**
 * An ACTIVE service worker registration. `getRegistration()` alone can return
 * a registration whose worker is still installing/waiting — subscribing on
 * that aborts (AbortError). A registration EXISTS here (checked first), so
 * `ready` resolves promptly; we never call it blind (it pends forever when no
 * service worker is registered — the original test-notification hang).
 */
async function getActiveRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const exists = await navigator.serviceWorker.getRegistration()
  if (!exists) return null
  const reg = await navigator.serviceWorker.ready
  return reg ?? exists
}

/** Turn a thrown subscription error into an actionable message. */
function describePushError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)
  switch (name) {
    case 'NotAllowedError':
      return 'The browser blocked the subscription (NotAllowedError) — check the site notification permission.'
    case 'AbortError':
      return 'The browser cancelled the subscription (AbortError) — common causes: the permission prompt was dismissed just now, the service worker was still activating (retry in a moment), or in Brave the "Use Google services for push messaging" toggle (brave://settings/privacy) is off.'
    case 'SecurityError':
      return 'The browser refused the subscription outside a secure/user-action context (SecurityError).'
    default:
      return `Subscribing failed: ${message || 'unknown error'}`
  }
}
