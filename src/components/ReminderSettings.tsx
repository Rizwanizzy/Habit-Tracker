import { useState } from 'react'
import type { UseNotificationSettingsResult } from '../hooks/useNotificationSettings'
import { reminderTimeOr } from '../lib/reminders'
import { IconCheck } from './icons'

/**
 * Daily-reminder preferences + this-device subscription controls inside the
 * Settings notification card (Pass 2 app integration). Rendered once browser
 * notification permission is granted — requires authentication automatically
 * (Settings lives inside RequireAuth).
 *
 * Data flows through `useNotificationSettings` (optimistic with rollback);
 * UI chrome follows VacationCard (role="switch" row) and `.date-field`
 * for the iOS-critical time input.
 */
export function ReminderSettings({ reminders }: { reminders: UseNotificationSettingsResult }) {
  const {
    settings,
    devices,
    subscribedThisDevice,
    loading,
    error,
    saveSettings,
    subscribeThisDevice,
    unsubscribeThisDevice,
  } = reminders
  const [busy, setBusy] = useState<'save' | 'subscribe' | 'unsubscribe' | null>(null)

  const enabled = settings?.reminder_enabled ?? false
  const time = reminderTimeOr(settings)

  async function run(op: 'save' | 'subscribe' | 'unsubscribe', action: () => Promise<boolean>) {
    setBusy(op)
    await action()
    setBusy(null)
  }

  if (loading) {
    return (
      <p className="mt-4 text-caption text-fg-muted" role="status">
        Loading reminders…
      </p>
    )
  }

  const deviceCount = devices.length

  return (
    <div className="mt-4 space-y-3">
      {/* Daily reminder switch (VacationCard chrome) + reminder time. */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy !== null}
        onClick={() => void run('save', () => saveSettings(!enabled, time))}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 lg:min-h-11"
      >
        <span className="min-w-0">
          <span className="text-body block text-fg">
            {enabled ? 'Daily reminder is on' : 'Send daily reminders'}
          </span>
          <span className="text-caption mt-0.5 block text-fg-muted">
            {enabled ? time : 'One nudge a day at your chosen time (20:00 default)'}
          </span>
        </span>
        <span
          className={`ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
            enabled
              ? 'border-success/40 bg-success text-white'
              : 'border-border bg-surface text-transparent'
          }`}
          aria-hidden="true"
        >
          <IconCheck className="size-3.5" />
        </span>
      </button>

      {/* Reminder time (native time input; .date-field handles iOS quirks). */}
      <label htmlFor="reminder-time" className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-body text-fg">Reminder time</span>
        <input
          id="reminder-time"
          type="time"
          value={time}
          disabled={busy !== null}
          onChange={(e) => void run('save', () => saveSettings(enabled, e.target.value))}
          className="date-field w-32 max-w-full min-w-0 box-border rounded-input border border-border bg-surface-raised px-3 text-fg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
        />
      </label>

      {/* This device subscription row. */}
      <div className="rounded-input border border-border bg-surface-raised px-3 py-2">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="text-body block text-fg">
              {subscribedThisDevice ? 'This device is registered' : 'Register this device'}
            </span>
            <span className="text-caption mt-0.5 block text-fg-muted">
              {subscribedThisDevice
                ? deviceCount > 1
                  ? `Push is set up — ${deviceCount} devices registered`
                  : 'Push is set up for this device'
                : 'Needed to receive push reminders on this browser'}
            </span>
          </span>
          {subscribedThisDevice ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('unsubscribe', unsubscribeThisDevice)}
              className="glass-pill inline-flex h-9 shrink-0 items-center justify-center rounded-pill border border-border px-3.5 text-caption font-medium text-fg transition-colors duration-150 hover:bg-surface active:scale-95 disabled:opacity-60"
            >
              {busy === 'unsubscribe' ? 'Removing…' : 'Remove'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('subscribe', subscribeThisDevice)}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-pill bg-accent-gradient px-3.5 text-caption font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {busy === 'subscribe' ? 'Subscribing…' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
