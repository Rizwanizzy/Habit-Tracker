import { Link } from 'react-router-dom'

/** Recovery final screen: shown after the password was updated and the
 *  recovery session was signed out (best-effort). Deliberately does NOT
 *  claim anything about other devices — updateUser does not revoke them. */
export function RecoverySuccessCard() {
  return (
    <main className="glass-card fade-up w-full max-w-sm rounded-card p-6 text-center sm:p-8">
      <img src="/logo.png" alt="Habit Tracker" className="mx-auto mb-3 size-[72px]" aria-hidden="true" />
      <h1 className="text-page-title mt-1">Password updated</h1>
      <p className="text-body mt-2 text-fg-muted">
        Your new password is ready. Sign in with it to continue.
      </p>
      <Link
        to="/login"
        replace
        className="bg-accent-gradient glow-accent mt-6 flex h-12 w-full items-center justify-center rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110"
      >
        Back to sign in
      </Link>
    </main>
  )
}
