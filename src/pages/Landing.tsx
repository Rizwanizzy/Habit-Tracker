/* Public landing page for signed-out visitors: shows the app's identity
   without a login (Google brand-verification requires the home page to be
   login-free and to display the app's name), with sign-in entry points. */
import { Link } from 'react-router-dom'

const FEATURES = [
  ['One-tap check-ins', 'Start or finish a habit from its tile — today or any past date.'],
  ['Streaks that survive', 'Skipped days and vacation breaks stay neutral instead of wiping your history.'],
  ['Charts and heatmaps', 'Glowing score lines, weekly/monthly/yearly completion views.'],
  ['Synced everywhere', 'Installable PWA; your habits follow you across devices.'],
]

export function Landing() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-6">
      <div className="glass-card fade-up w-full max-w-2xl rounded-card p-5 sm:p-6">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Habit Tracker logo" className="size-[64px] mb-2" />
          <h1 className="text-page-title mt-1">Habit Tracker</h1>
          <p className="text-caption mt-1 text-fg-muted">
            Track habits with one-tap check-ins, streaks, scores and charts
          </p>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(([title, body]) => (
            <li key={title} className="rounded-input bg-surface-2/40 p-3">
              <p className="text-caption font-semibold text-fg">{title}</p>
              <p className="mt-0.5 text-[12px] leading-none text-fg-muted">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/login"
            className="bg-accent-gradient glow-accent inline-flex h-11 w-full items-center justify-center rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 sm:w-auto sm:px-8"
          >
            Sign in
          </Link>
          <Link to="/privacy" className="text-caption text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Privacy policy
          </Link>
        </div>
      </div>
    </div>
  )
}
