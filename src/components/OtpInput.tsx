import { forwardRef, type ClipboardEvent } from 'react'
import { otpSlots, sanitizeOtp } from '../lib/authEmail'

interface Props {
  /** Current digits only (string, max 6 — leading zeros preserved). */
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  invalid?: boolean
  /** Mobile OTP autofill + immediate typing readiness. */
  autoFocus?: boolean
}

/** One real, accessible input with a six-slot visual presentation.
 *  The transparent native input keeps mobile keyboards, paste and
 *  `one-time-code` autofill working; the slots are presentation only. */
export const OtpInput = forwardRef<HTMLInputElement, Props>(function OtpInput(
  { value, onChange, disabled = false, invalid = false, autoFocus = false },
  ref,
) {
  const slots = otpSlots(value)

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const next = sanitizeOtp(event.clipboardData.getData('text'))
    if (next) onChange(next)
  }

  return (
    <div
      className={`relative grid h-14 grid-cols-6 gap-1.5 rounded-input sm:h-16 sm:gap-2 ${
        invalid ? 'border-danger ring-1 ring-danger/40' : ''
      }`}
    >
      <input
        ref={ref}
        id="otp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        pattern="[0-9]{6}"
        enterKeyHint="done"
        maxLength={6}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(sanitizeOtp(event.target.value))}
        onPaste={handlePaste}
        aria-label="6-digit verification code"
        aria-describedby="otp-help"
        aria-invalid={invalid || undefined}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
      />

      {slots.map((digit, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`grid min-w-0 place-items-center rounded-input border bg-surface text-fg ${
            digit
              ? 'border-accent'
              : index === value.length
                ? 'border-accent/70'
                : 'border-border'
          } ${disabled ? 'opacity-60' : ''}`}
        >
          <span className="text-xl font-semibold tabular-nums sm:text-2xl">{digit}</span>
        </div>
      ))}
    </div>
  )
})
