import { useState, type FormEvent } from 'react'
import { IconEye, IconEyeOff } from './icons'
import { AuthErrorNotice } from './AuthErrorNotice'
import { validatePasswordPair } from '../lib/authRecovery'

interface Props {
  busy: boolean
  /** Server-side error (e.g. weak password per the Supabase policy). */
  error: string | null
  /** Called only after the pair validates locally; receives the new password. */
  onSubmit: (newPassword: string) => void
}

/** New + confirm password fields with show/hide controls. The configured
 *  Supabase password policy is the only strength rule — no invented checks. */
export function NewPasswordForm({ busy, error, onSubmit }: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const pairError = validatePasswordPair(newPassword, confirmPassword)
    if (pairError) {
      setLocalError(pairError)
      return
    }
    setLocalError(null)
    onSubmit(newPassword)
  }

  const toggleLabel = show ? 'Hide password' : 'Show password'

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="new-password" className="block text-caption text-fg-muted">
        New password
      </label>
      <div className="relative mt-2">
        <input
          id="new-password"
          type={show ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="input-field pr-12"
          placeholder="New password"
        />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={toggleLabel}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-pill text-fg-muted transition-colors duration-150 hover:bg-surface-raised hover:text-fg"
        >
          {show ? <IconEyeOff className="size-5" /> : <IconEye className="size-5" />}
        </button>
      </div>

      <label htmlFor="confirm-password" className="mt-4 block text-caption text-fg-muted">
        Confirm new password
      </label>
      <input
        id="confirm-password"
        type={show ? 'text' : 'password'}
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="input-field mt-2"
        placeholder="Repeat the new password"
      />

      {(localError || error) && <AuthErrorNotice message={localError ?? error ?? ''} />}

      <button
        type="submit"
        disabled={busy}
        className="bg-accent-gradient glow-accent mt-6 h-12 w-full rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:opacity-60"
      >
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
