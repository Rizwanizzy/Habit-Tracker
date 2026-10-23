import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Redirects to /login when there is no session; shows a loading state while checking. */
export function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="grid min-h-dvh place-items-center bg-background text-fg-muted"
        role="status"
      >
        <span className="text-body">Loading…</span>
      </div>
    )
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />
}