import { useState } from 'react'
import { useNotificationPermission } from '../hooks/useNotificationPermission'
import { useNotificationSettings } from '../hooks/useNotificationSettings'
import { ReminderSettings } from './ReminderSettings'
import { IconBell } from './icons'

/**
 * Settings "Reminders" card — capability detection, permission request and
 * local test (Pass 1) plus the compact per-account reminder rows (Pass 2,
 * rendered by `ReminderSettings` once permission is granted).
 *
 * Compact spec: header shows ONE status chip ("On" / "Off" / "Blocked" /
 * "Unavailable"); each non-granted state shows at most one short line and
 * one pill. Helper paragraphs are intentionally removed.
 */
export function NotificationCard() {
  const { capabilities, isRequesting, requestPermission, sendTest } = useNotificationPermission()
  const reminders = useNotificationSettings()
  const [testSent, setTestSent] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const { isSupported, permission, requiresPWAInstall } = capabilities
  const enabled = reminders.settings?.reminder_enabled ?? false

  async function handleEnable() {
    await requestPermission()
  }

  async function handleSendTest() {
    setTestError(null)
    setTestSent(false)
    const result = await sendTest()
    if (result.ok) {
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3500)
      console.info('[notifications] test dispatched via', result.via)
    } else {
      // Structured error from the lib (never silently swallowed).
      setTestError(result.error ?? 'Failed to send test notification.')
    }
  }

  const chip = !isSupported
    ? { text: 'Unavailable', cls: 'border-border bg-surface text-fg-muted', dot: 'bg-fg-muted' }
    : permission === 'denied'
      ? { text: 'Blocked', cls: 'border-danger/35 bg-danger/15 text-danger', dot: 'bg-danger' }
      : enabled
        ? { text: 'On', cls: 'border-success/35 bg-success/15 text-success', dot: 'bg-success' }
        : { text: 'Off', cls: 'border-border bg-surface text-fg-muted', dot: 'bg-fg-muted' }

  return (
    <section
      className="glass-card fade-up min-w-0 rounded-card p-4 lg:col-span-1 lg:order-none lg:p-6 order-4 col-span-2"
      style={{ animationDelay: '100ms' }}
    >
      {/* Header: bell + title on the left, one status chip on the right. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent" aria-hidden="true">
            <IconBell className="size-4" />
          </span>
          <h2 className="text-section-title truncate">Reminders</h2>
        </div>
        <div aria-live="polite">
          <span className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-caption font-medium ${chip.cls}`}>
            <span className={`size-1.5 rounded-full ${chip.dot}`} aria-hidden="true" />
            {chip.text}
          </span>
        </div>
      </div>

      {/* iOS PWA requirement (the one case with unfakeable context). */}
      {requiresPWAInstall && (
        <div className="mt-4 rounded-input border border-accent/25 bg-accent/10 p-3 text-[13px] leading-relaxed text-fg-secondary">
          <p className="font-medium text-fg">iPhone / iPad: add to Home Screen first</p>
          <p className="mt-0.5 text-caption text-fg-muted">iOS 16.4+ supports Web Push only from the Home Screen app.</p>
        </div>
      )}

      {/* Permission states (compact — one line each, no paragraphs). */}
      {!isSupported && !requiresPWAInstall && (
        <p className="mt-4 text-[13px] text-fg-secondary">This browser doesn't support notifications.</p>
      )}

      {permission === 'default' && isSupported && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={isRequesting}
            className="inline-flex h-11 items-center justify-center rounded-pill bg-accent-gradient px-5 text-body font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            {isRequesting ? 'Requesting…' : 'Enable notifications'}
          </button>
        </div>
      )}

      {permission === 'denied' && (
        <p className="mt-4 text-[13px] text-fg-secondary">Notifications are blocked in your browser settings.</p>
      )}

      {/* Granted: compact reminder rows (switch / time / device actions). */}
      {permission === 'granted' && (
        <ReminderSettings
          reminders={reminders}
          onSendTest={handleSendTest}
          testSent={testSent}
          testError={testError}
        />
      )}
    </section>
  )
}
