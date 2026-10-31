/* Public landing page for signed-out visitors: shows the app's identity
   without a login (Google brand-verification requires the home page to be
   login-free and to display the app's name), with sign-in entry points. */
import { Link } from 'react-router-dom'

const FEATURES = [
  ['One-tap check-ins', 'Start or finish a habit from its tile — today or any past date, with a paywall-free day-start shift for after-midnight check-ins.'],
  ['Streaks that survive', 'Scores, current/best streaks and completion rates; skipped days and vacation breaks stay neutral instead of wiping your history.'],
  ['Charts and heatmaps', 'A glowing score line per habit, weekly/monthly/yearly completion views and a calendar heatmap on every habit page.'],
  ['Synced everywhere', 'Installable PWA; your habits follow you across devices through your account.'],
]

export function Landing() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass-card fade-up w-full max-w-2xl rounded-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Habit Tracker logo" className="size-[84px] mb-3" />
          <h1 className="text-page-title mt-2">Habit Tracker</h1>
          <p className="text-caption mt-1 text-fg-muted">
            Track habits with one-tap check-ins, streaks, scores and charts
          </p>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(([title, body]) => (
            <li key={title} className="rounded-input bg-surface-2/40 p-4">
              <p className="text-body font-semibold text-fg">{title}</p>
              <p className="mt-1 text-body text-fg-muted">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/login"
            className="bg-accent-gradient glow-accent inline-flex h-12 w-full items-center justify-center rounded-pill text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 sm:w-auto sm:px-10"
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
