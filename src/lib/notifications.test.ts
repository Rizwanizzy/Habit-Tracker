import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPushCapabilities,
  requestNotificationPermission,
  urlBase64ToUint8Array,
  sendLocalTestNotification,
} from './notifications'

describe('notifications library', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
    delete (globalThis as unknown as { Notification?: unknown }).Notification
    delete (globalThis as unknown as { PushManager?: unknown }).PushManager
    delete (globalThis as unknown as { navigator?: unknown }).navigator
  })

  describe('urlBase64ToUint8Array', () => {
    it('correctly converts standard base64 string to Uint8Array', () => {
      // "Hello World" in base64 is "SGVsbG8gV29ybGQ="
      const bytes = urlBase64ToUint8Array('SGVsbG8gV29ybGQ=')
      const text = new TextDecoder().decode(bytes)
      expect(text).toBe('Hello World')
    })

    it('correctly converts URL-safe base64 string without padding', () => {
      // URL-safe base64 with - and _ and missing padding
      const input = 'SGVsbG8tV29ybGRf'
      const bytes = urlBase64ToUint8Array(input)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBeGreaterThan(0)
    })
  })

  describe('getPushCapabilities', () => {
    it('returns unsupported in non-browser environment when window is missing', () => {
      delete (globalThis as unknown as { window?: unknown }).window
      const caps = getPushCapabilities()
      expect(caps.isSupported).toBe(false)
      expect(caps.permission).toBe('unsupported')
      expect(caps.hasNotificationSupport).toBe(false)
      expect(caps.hasServiceWorkerSupport).toBe(false)
    })

    it('detects when Notification, ServiceWorker, and PushManager are present', () => {
      const mockWindow = {
        Notification: {
          permission: 'default',
          requestPermission: vi.fn(),
        },
        PushManager: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      }
      const mockNavigator = {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }

      ;(globalThis as unknown as { window: unknown }).window = mockWindow
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockWindow.Notification
      ;(globalThis as unknown as { PushManager: unknown }).PushManager = mockWindow.PushManager
      ;(globalThis as unknown as { navigator: unknown }).navigator = mockNavigator

      const caps = getPushCapabilities()
      expect(caps.hasNotificationSupport).toBe(true)
      expect(caps.hasServiceWorkerSupport).toBe(true)
      expect(caps.hasPushManagerSupport).toBe(true)
      expect(caps.isSupported).toBe(true)
      expect(caps.permission).toBe('default')
      expect(caps.isStandalone).toBe(false)
      expect(caps.isIOS).toBe(false)
    })

    it('handles missing Notification gracefully', () => {
      const mockWindow = {
        PushManager: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      }
      const mockNavigator = {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0',
      }

      ;(globalThis as unknown as { window: unknown }).window = mockWindow
      ;(globalThis as unknown as { navigator: unknown }).navigator = mockNavigator

      const caps = getPushCapabilities()
      expect(caps.hasNotificationSupport).toBe(false)
      expect(caps.isSupported).toBe(false)
      expect(caps.permission).toBe('unsupported')
    })

    it('detects standalone PWA mode', () => {
      const mockWindow = {
        Notification: { permission: 'granted' },
        PushManager: {},
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      }
      const mockNavigator = {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0',
      }

      ;(globalThis as unknown as { window: unknown }).window = mockWindow
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockWindow.Notification
      ;(globalThis as unknown as { PushManager: unknown }).PushManager = mockWindow.PushManager
      ;(globalThis as unknown as { navigator: unknown }).navigator = mockNavigator

      const caps = getPushCapabilities()
      expect(caps.isStandalone).toBe(true)
    })

    it('detects iOS requirements (requires Home Screen PWA installation)', () => {
      const mockWindow = {
        Notification: { permission: 'default' },
        PushManager: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      }
      const mockNavigator = {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
      }

      ;(globalThis as unknown as { window: unknown }).window = mockWindow
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockWindow.Notification
      ;(globalThis as unknown as { PushManager: unknown }).PushManager = mockWindow.PushManager
      ;(globalThis as unknown as { navigator: unknown }).navigator = mockNavigator

      const caps = getPushCapabilities()
      expect(caps.isIOS).toBe(true)
      expect(caps.isStandalone).toBe(false)
      expect(caps.requiresPWAInstall).toBe(true)
    })
  })

  describe('requestNotificationPermission', () => {
    it('returns unsupported when window or Notification API is missing', async () => {
      delete (globalThis as unknown as { window?: unknown }).window
      const result = await requestNotificationPermission()
      expect(result).toBe('unsupported')
    })

    it('returns granted immediately without prompt if already granted', async () => {
      const requestMock = vi.fn()
      const mockNotification = {
        permission: 'granted',
        requestPermission: requestMock,
      }
      ;(globalThis as unknown as { window: unknown }).window = { Notification: mockNotification }
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockNotification

      const result = await requestNotificationPermission()
      expect(result).toBe('granted')
      expect(requestMock).not.toHaveBeenCalled()
    })

    it('returns denied immediately without prompt if already denied', async () => {
      const requestMock = vi.fn()
      const mockNotification = {
        permission: 'denied',
        requestPermission: requestMock,
      }
      ;(globalThis as unknown as { window: unknown }).window = { Notification: mockNotification }
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockNotification

      const result = await requestNotificationPermission()
      expect(result).toBe('denied')
      expect(requestMock).not.toHaveBeenCalled()
    })

    it('prompts user and returns result when permission is default', async () => {
      const requestMock = vi.fn().mockResolvedValue('granted')
      const mockNotification = {
        permission: 'default',
        requestPermission: requestMock,
      }
      ;(globalThis as unknown as { window: unknown }).window = { Notification: mockNotification }
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockNotification

      const result = await requestNotificationPermission()
      expect(result).toBe('granted')
      expect(requestMock).toHaveBeenCalled()
    })

    it('returns denied when requestPermission throws an error', async () => {
      const requestMock = vi.fn().mockRejectedValue(new Error('Permission dismissed'))
      const mockNotification = {
        permission: 'default',
        requestPermission: requestMock,
      }
      ;(globalThis as unknown as { window: unknown }).window = { Notification: mockNotification }
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockNotification

      const result = await requestNotificationPermission()
      expect(result).toBe('denied')
    })
  })

  describe('sendLocalTestNotification', () => {
    function mockNotificationApi(ctor: unknown, permission = 'granted') {
      // The static `permission` lives on the constructor object itself.
      const api = ctor as unknown as Record<string, unknown>
      api.permission = permission
      ;(globalThis as unknown as { window: unknown }).window = { Notification: api }
      ;(globalThis as unknown as { Notification: unknown }).Notification = api
    }

    it('returns ok:false with an explanation when the Notification API is unavailable', async () => {
      delete (globalThis as unknown as { window?: unknown }).window
      const result = await sendLocalTestNotification('Test')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Notification API/i)
    })

    it('returns ok:false with the permission named when it is not granted', async () => {
      mockNotificationApi(function MockNotification() {}, 'default')
      const result = await sendLocalTestNotification('Test')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/"default"/)
    })

    it('prefers ServiceWorkerRegistration.showNotification when a registration is active', async () => {
      const showMock = vi.fn().mockResolvedValue(undefined)
      const mockNotification = function MockNotification(this: unknown) {}
      Object.assign(mockNotification, { permission: 'granted' })
      ;(globalThis as unknown as { window: unknown }).window = { Notification: mockNotification }
      ;(globalThis as unknown as { Notification: unknown }).Notification = mockNotification
      ;(globalThis as unknown as { navigator: unknown }).navigator = {
        serviceWorker: {
          getRegistration: vi.fn().mockResolvedValue({ showNotification: showMock }),
        },
      }

      const result = await sendLocalTestNotification('Hello', { body: 'World' })
      expect(result).toEqual({ ok: true, via: 'service-worker', error: null })
      expect(showMock).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({ body: 'World', tag: 'test-notification', renotify: true }),
      )
    })

    it('falls back to the Notification constructor when no service worker is registered (no hang)', async () => {
      const ctorMock = vi.fn()
      mockNotificationApi(ctorMock)
      ;(globalThis as unknown as { navigator: unknown }).navigator = {
        serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) },
      }

      const result = await sendLocalTestNotification('Hello')
      expect(ctorMock).toHaveBeenCalledWith('Hello', expect.objectContaining({ tag: 'test-notification', renotify: true }))
      expect(result.ok).toBe(true)
      expect(result.via).toBe('notification-api')
      expect(result.error).toBeNull()
    })

    it('falls back to the constructor when the service worker path rejects, then fails loudly when it throws', async () => {
      const ctorMock = vi.fn()
        .mockImplementationOnce(function MockNotification() {})
        .mockImplementationOnce(() => {
          throw new DOMException('denied', 'NotAllowedError')
        })
      mockNotificationApi(ctorMock)
      // Call 1: a registration exists but showNotification rejects → must fall
      // back. Call 2: no registration → constructor is the only path.
      const getRegistration = vi
        .fn()
        .mockResolvedValueOnce({
          showNotification: vi.fn().mockRejectedValue(new Error('SW display failed')),
        })
        .mockResolvedValueOnce(undefined)
      ;(globalThis as unknown as { navigator: unknown }).navigator = {
        serviceWorker: { getRegistration },
      }

      const fallback = await sendLocalTestNotification('Hello')
      expect(fallback.ok).toBe(true)
      expect(fallback.via).toBe('notification-api')

      // Second attempt: no SW and a throwing constructor — must return a
      // structured, actionable error (never a silent false).
      const failed = await sendLocalTestNotification('Hello')
      expect(failed.ok).toBe(false)
      expect(failed.error).toMatch(/NotAllowedError/i)
    })
  })
})
