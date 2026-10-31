/* Public privacy policy page (Google consent-screen requirement): reachable
   without auth at /privacy, simple glass card over the aurora background. */
import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'mohammedrizwanizzy1997@gmail.com'

export function Privacy() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass-card fade-up w-full max-w-2xl rounded-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="" aria-hidden="true" className="size-[64px] mb-3" />
          <h1 className="text-page-title">Privacy policy</h1>
          <p className="text-caption mt-1 text-fg-muted">Habit Tracker — last updated 1 November 2026</p>
        </div>

        <div className="mt-6 space-y-4 text-body text-fg-muted">
          <p>
            <span className="font-semibold text-fg">What this app stores.</span> Habit Tracker is a
            personal habit-tracking app. Everything you record — habits, check-ins, profile details,
            settings — is stored in the app's own Supabase database, protected by your login, and is
            visible only to your account.
          </p>
          <p>
            <span className="font-semibold text-fg">Sign in with Google.</span> When you sign in with
            Google, the app receives your name, email address and profile picture from Google solely
            to identify your account and show them in the app. The app never posts to your Google
            account, never reads anything beyond this basic profile information, and never shares it
            with third parties.
          </p>
          <p>
            <span className="font-semibold text-fg">No other data collection.</span> The app contains
            no advertising, no analytics, no payments and no tracking scripts. Photos you upload are
            stored privately in the app's own storage bucket.
          </p>
          <p>
            <span className="font-semibold text-fg">Data control.</span> You can delete your data at
            any time from inside the app (archiving/removing habits, clearing profile fields), or
            request full deletion by contacting <span className="text-fg">{CONTACT_EMAIL}</span>.
          </p>
        </div>

        <Link
          to="/"
          className="glass-pill mt-8 inline-flex h-12 items-center justify-center rounded-pill px-6 text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised"
        >
          Back to the app
        </Link>
      </div>
    </div>
  )
}
