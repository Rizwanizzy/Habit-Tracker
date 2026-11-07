import { useState } from 'react'
import type { UseNotificationSettingsResult } from '../hooks/useNotificationSettings'
import { reminderTimeOr } from '../lib/reminders'
import { IconBell, IconClock } from './icons'

/** ISO-ish 'HH:MM[:ss]' → short 12-hour label, no leading zero ("5:03 PM"). */
function twelveHour(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{1,2})/.exec(hhmm)
  const h = m ? Number(m[1]) : 0
  const min = m ? Number(m[2]) : 0
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, h, min))
}

/** The overlay input deliberately does NOT use `.date-field`: its unlayered
 *  appearance:none/height rules interfere with Chromium's native picker.
 *  Native time inputs otherwise open their picker from the small right-side
 *  indicator only; a click anywhere in the field should open it.
 *  showPicker() does that on desktop Chromium/Firefox and Android; iOS
 *  Safari does not implement it (throws — swallowed) and instead opens the
 *  picker on the direct tap of the invisible input itself, so both
 *  platforms get the "click anywhere" behaviour without double-opening. */
function openTimePicker(e: React.MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker()
  } catch {
    /* platform without showPicker uses its own direct-tap behaviour */
  }
}

/** Shared pill chrome: 40px visual + vertical-only invisible pad to 44px
 *  (BackupCard pattern; grids need min-w-0 pills with no horizontal pad,
 *  so the pad only extends the tap area vertically). */
const pillBase =
  'relative inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-caption font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""] active:scale-95'

/**
 * Granted-state rows of the Settings "Reminders" card (Pass 2 logic,
 * Pass 3 compact layout): a Vacation-style switch row, a time row whose
 * field dims + goes `inert` while the reminder is off, and a footer of
 * secondary pills (send test / device registration). All behaviour binds
 * to the existing `useNotificationSettings` handlers unchanged.
 */
export function ReminderSettings({
  reminders,
  onSendTest,
  testSent,
  testError,
}: {
  reminders: UseNotificationSettingsResult
  onSendTest: () => Promise<void> | void
  testSent: boolean
  testError: string | null
}) {
  const {
    settings,
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

  return (
    <div className="mt-4 space-y-2.5">
      {/* Daily reminder switch (Vacation "Pause all habits" switch style). */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy !== null}
        onClick={() => void run('save', () => saveSettings(!enabled, time))}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60 lg:min-h-11"
      >
        <span className="text-body text-fg">Daily reminder</span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-200 ${
            enabled ? 'bg-accent' : 'bg-fg/20'
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200 ${
              enabled ? 'left-[1.4rem]' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {/* Time row: visible but dimmed + non-interactive while off. The
          field is Vacation's DateField pattern — a visual layer with the
          clock icon and 12-hour no-leading-zero text, with the real
          native <input type="time"> stretched over it at opacity-0.
          showPicker() (openTimePicker) makes any click in the field open
          the picker on desktop/Android; iOS Safari ignores it and opens
          on the direct tap of the invisible input instead. */}
      <div
        className={`flex min-h-14 items-center justify-between gap-3 pt-1 transition-opacity duration-150 lg:min-h-11 ${
          enabled ? '' : 'pointer-events-none opacity-50'
        }`}
      >
        <span className="text-body shrink-0 text-fg">Time</span>
        <div className="group relative w-[130px] min-w-[120px] shrink-0">
          <div
            aria-hidden="true"
            className="pointer-events-none flex h-12 w-full items-center gap-2 rounded-input border border-border bg-surface-raised px-3 text-left transition-colors duration-150 group-hover:bg-surface"
          >
            <IconClock className="size-4 shrink-0 text-fg-muted" />
            <span className="min-w-0 truncate text-base text-fg">{twelveHour(time)}</span>
          </div>
          <input
            type="time"
            value={time}
            disabled={busy !== null || !enabled}
            aria-label="Reminder time"
            onChange={(e) => void run('save', () => saveSettings(enabled, e.target.value))}
            onClick={openTimePicker}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-input text-base opacity-0"
          />
        </div>
      </div>

      {/* Footer actions. Registered: two ghost pills (phones = 2-up grid,
          desktop = left-aligned pair). Not registered: one accent pill. */}
      {subscribedThisDevice ? (
        <div className="grid grid-cols-2 gap-2 lg:inline-flex lg:gap-2">
          <button
            type="button"
            onClick={() => void onSendTest()}
            className={`${pillBase} border border-border bg-transparent text-fg hover:bg-surface`}
          >
            <IconBell className="size-4 shrink-0 text-fg-muted" />
            Send test
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('unsubscribe', unsubscribeThisDevice)}
            className={`${pillBase} border border-danger/35 bg-danger/15 text-danger hover:bg-danger/25`}
          >
            {busy === 'unsubscribe' ? 'Removing…' : 'Remove device'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('subscribe', subscribeThisDevice)}
          className={`${pillBase} bg-accent-gradient font-semibold text-white shadow-sm hover:brightness-110`}
        >
          {busy === 'subscribe' ? 'Subscribing…' : 'Enable on this device'}
        </button>
      )}

      {/* Compact feedback lines (success is brief, failures visible). */}
      {testSent && <p className="text-caption text-success">Test notification sent!</p>}
      {testError && (
        <p role="alert" className="text-caption text-danger">
          {testError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
