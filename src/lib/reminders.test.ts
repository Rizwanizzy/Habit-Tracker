import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_TIME,
  DEFAULT_TIMEZONE,
  describeDevice,
  extractSubscriptionPayload,
  getVapidPublicKey,
  normalizeReminderTime,
  reminderTimeOr,
  VAPID_KEY_ENV,
} from './reminders'

describe('getVapidPublicKey', () => {
  it('returns the trimmed key when the env var exists', () => {
    const env = { [VAPID_KEY_ENV]: `  BDBZfXYkkHrFN4  ` }
    expect(getVapidPublicKey(env)).toBe('BDBZfXYkkHrFN4')
  })

  it('returns null when the env var is missing, blank, or env is not an object', () => {
    expect(getVapidPublicKey({})).toBeNull()
    expect(getVapidPublicKey({ [VAPID_KEY_ENV]: '   ' })).toBeNull()
    expect(getVapidPublicKey({ [VAPID_KEY_ENV]: 42 })).toBeNull()
    expect(getVapidPublicKey(null)).toBeNull()
    expect(getVapidPublicKey('nope')).toBeNull()
  })
})

describe('extractSubscriptionPayload', () => {
  it('extracts endpoint + keys from a toJSON()-shaped subscription', () => {
    const json = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'BPK', auth: 'aGk' },
      expirationTime: null,
    }
    expect(extractSubscriptionPayload(json)).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: 'BPK',
      auth: 'aGk',
    })
  })

  it('trims the endpoint', () => {
    const json = { endpoint: '  https://push.example.com/sub  ', keys: { p256dh: 'B', auth: 'a' } }
    expect(extractSubscriptionPayload(json)?.endpoint).toBe('https://push.example.com/sub')
  })

  it('returns null for missing endpoint, missing keys, or blank key material', () => {
    const keys = { p256dh: 'B', auth: 'a' }
    expect(extractSubscriptionPayload({ keys })).toBeNull()
    expect(extractSubscriptionPayload({ endpoint: 'https://e', keys: { p256dh: 'B' } })).toBeNull()
    expect(extractSubscriptionPayload({ endpoint: 'https://e', keys: { auth: 'a' } })).toBeNull()
    expect(extractSubscriptionPayload({ endpoint: '   ', keys })).toBeNull()
    expect(extractSubscriptionPayload({ endpoint: 'https://e', keys: { p256dh: '  ', auth: 'a' } })).toBeNull()
    expect(extractSubscriptionPayload(null)).toBeNull()
    expect(extractSubscriptionPayload('x')).toBeNull()
    expect(extractSubscriptionPayload(undefined)).toBeNull()
  })
})

describe('normalizeReminderTime', () => {
  it('canonicalizes H:MM, HH:MM and HH:MM:SS to HH:MM', () => {
    expect(normalizeReminderTime('9:05')).toBe('09:05')
    expect(normalizeReminderTime('20:00')).toBe('20:00')
    expect(normalizeReminderTime('20:00:00')).toBe('20:00')
    expect(normalizeReminderTime('23:59')).toBe('23:59')
    expect(normalizeReminderTime(' 20:00 ')).toBe('20:00')
  })

  it('returns null for malformed or out-of-range values', () => {
    expect(normalizeReminderTime(null)).toBeNull()
    expect(normalizeReminderTime(undefined)).toBeNull()
    expect(normalizeReminderTime('')).toBeNull()
    expect(normalizeReminderTime('24:00')).toBeNull()
    expect(normalizeReminderTime('20:60')).toBeNull()
    expect(normalizeReminderTime('20:0')).toBeNull()
    expect(normalizeReminderTime('noon')).toBeNull()
    expect(normalizeReminderTime('20:00:99')).toBeNull()
  })
})

describe('reminderTimeOr', () => {
  it('falls back to the default time for null settings or invalid stored time', () => {
    const row = {
      user_id: 'u1',
      reminder_enabled: true,
      reminder_time: '07:15:00',
      timezone: DEFAULT_TIMEZONE,
    }
    expect(reminderTimeOr(row)).toBe('07:15')
    expect(reminderTimeOr(null)).toBe(DEFAULT_REMINDER_TIME)
    expect(reminderTimeOr({ ...row, reminder_time: 'bad' })).toBe(DEFAULT_REMINDER_TIME)
  })
})

describe('describeDevice', () => {
  it('labels common desktop user agents', () => {
    const chromeWin =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    expect(describeDevice(chromeWin)).toBe('Chrome on Windows')

    const edgeWin =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
    expect(describeDevice(edgeWin)).toBe('Edge on Windows')

    const safariMac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    expect(describeDevice(safariMac)).toBe('Safari on macOS')

    const firefoxWin =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
    expect(describeDevice(firefoxWin)).toBe('Firefox on Windows')
  })

  it('labels mobile user agents, including spoofed iOS browsers', () => {
    const chromeAndroid =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
    expect(describeDevice(chromeAndroid)).toBe('Chrome on Android')

    const safariIOS =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    expect(describeDevice(safariIOS)).toBe('Safari on iPhone')

    const chromeIOS =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1'
    expect(describeDevice(chromeIOS)).toBe('Chrome on iPhone')

    const firefoxIOS =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15'
    expect(describeDevice(firefoxIOS)).toBe('Firefox on iPhone')
  })

  it('falls back gracefully for unrecognized user agents', () => {
    expect(describeDevice('weird-agent/1.0')).toBe('Browser on Device')
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64) Chromium/100.0 x')).toBe('Browser on Device')
  })
})
