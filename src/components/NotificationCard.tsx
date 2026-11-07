import { useState } from 'react'
import { useNotificationPermission } from '../hooks/useNotificationPermission'
import { IconBell, IconCheck } from './icons'

/**
 * Minimal Web Push capability detection & permission testing card (Pass 1).
 * Allows inspecting browser support and requesting notification permission on user action.
 */
export function NotificationCard() {
  const { capabilities, isRequesting, requestPermission, sendTest } = useNotificationPermission()
  const [testSent, setTestSent] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const { isSupported, permission, requiresPWAInstall } = capabilities

  async function handleEnable() {
    setTestError(null)
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

  return (
    <section
      className="glass-card fade-up col-span-2 order-4 rounded-card p-4 sm:p-5 lg:order-none lg:p-6"
      style={{ animationDelay: '100ms' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-accent/15 text-accent" aria-hidden="true">
            <IconBell className="size-4" />
          </span>
          <div>
            <h2 className="text-section-title">Daily Reminders</h2>
            <p className="text-caption text-fg-muted">Web Push foundation</p>
          </div>
        </div>

        {/* Status badge */}
        <div>
          {permission === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/35 bg-success/15 px-3 py-1 text-caption font-medium text-success">
              <span className="size-1.5 rounded-full bg-success" />
              Permission granted
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-danger/35 bg-danger/15 px-3 py-1 text-caption font-medium text-danger">
              <span className="size-1.5 rounded-full bg-danger" />
              Blocked in browser
            </span>
          ) : !isSupported ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-caption font-medium text-fg-muted">
              Unsupported
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-warning/35 bg-warning/15 px-3 py-1 text-caption font-medium text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Not enabled
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* iOS PWA Requirement notice */}
        {requiresPWAInstall && (
          <div className="rounded-input border border-accent/25 bg-accent/10 p-3 text-[13px] leading-relaxed text-fg-secondary">
            <p className="font-medium text-fg">iPhone / iPad Home Screen PWA required</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              iOS 16.4+ supports Web Push only when the app is added to the Home Screen. Tap the Share button in Safari, then tap <strong>Add to Home Screen</strong>.
            </p>
          </div>
        )}

        {/* Unsupported browser warning */}
        {!isSupported && !requiresPWAInstall && (
          <p className="text-[13px] text-fg-secondary">
            Web Push is not supported in this browser. To receive daily habit reminders, use modern Chrome, Edge, Firefox, or Safari on an updated OS.
          </p>
        )}

        {/* Default permission state */}
        {permission === 'default' && isSupported && (
          <div>
            <p className="text-[13px] text-fg-secondary">
              Allow notification permission so Habit Tracker can send you a reminder once a day to check in on your habits.
            </p>
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={isRequesting}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-pill bg-accent-gradient px-5 text-body font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {isRequesting ? 'Requesting…' : 'Enable notifications'}
            </button>
          </div>
        )}

        {/* Granted permission state */}
        {permission === 'granted' && (
          <div>
            <p className="text-[13px] text-fg-secondary">
              Notification permission is active. You can dispatch a local test notification to verify your device displays notifications properly.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleSendTest()}
                className="glass-pill inline-flex h-11 items-center justify-center rounded-pill border border-border px-5 text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised active:scale-95"
              >
                Send test notification
              </button>
              {testSent && (
                <span className="inline-flex items-center gap-1.5 text-caption font-medium text-success">
                  <IconCheck className="size-4" />
                  Test notification sent!
                </span>
              )}
            </div>
            {testError && (
              <p role="alert" className="mt-2 text-caption text-danger">
                {testError}
              </p>
            )}
          </div>
        )}

        {/* Denied permission state */}
        {permission === 'denied' && (
          <div className="rounded-input border border-border bg-surface p-3 text-[13px] text-fg-secondary">
            <p className="font-medium text-fg">Notifications blocked</p>
            <p className="mt-1 text-caption text-fg-muted">
              Permission was denied in your browser settings. To receive reminders, open your browser site permissions and change Notifications to &ldquo;Allow&rdquo;.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
