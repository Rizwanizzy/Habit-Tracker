import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Redirects to /login when there is no session; shows a loading state while checking. */
export function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-fg-muted">
        <div className="flex flex-col items-center gap-4">
          <div
            className="size-16 rounded-full border-6 border-fg/10 border-t-accent animate-spin"
            role="status"
            aria-label="Loading"
          />
          <span className="text-page-title text-fg">Signing you in…</span>
        </div>
      </div>
    )
  }

  // No session: show the PUBLIC landing page (Google app verification
  // requires a login-free, informative home page). Signed-in users move on.
  return session ? <Outlet /> : <Navigate to="/welcome" replace />
}