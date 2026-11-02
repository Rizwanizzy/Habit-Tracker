import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { getSupabase } from '../lib/supabase'
import type { ProfileInput } from '../lib/profile'
import { ProfileBanner } from '../components/ProfileBanner'
import { ProfileDetails } from '../components/ProfileDetails'
import { IconUser, IconLogout } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useProfileContext } from '../contexts/ProfileContext'

type Notice = { kind: 'success' | 'danger'; text: string } | null

/** Profile page (DESIGN.md §11): breadcrumb header, glass banner + avatar on
 *  top of the grid, and the Personal details card. Owns edit mode, toasts,
 *  and the loading / error states. */
export function Profile() {
  const {
    profile,
    loading,
    error,
    saving,
    uploading,
    email,
    emailConfirmed,
    avatarUrl,
    reload,
    save,
    uploadAvatar,
    removeAvatar,
  } = useProfileContext()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const navigate = useNavigate()

  async function signOut() {
    try {
      const sb = getSupabase()
      const { error } = await sb.auth.signOut()
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (err) {
      setNotice({ kind: 'danger', text: err instanceof Error ? err.message : 'Sign out failed' })
    }
  }

  // Auto-dismiss toasts: warnings stay long enough to be read (upload and
  // validation failures were vanishing at 2.6s and looked like "silently
  // failed" — user report), successes can stay snappy.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(
      () => setNotice(null),
      notice.kind === 'danger' ? 6000 : 2600,
    )
    return () => window.clearTimeout(timer)
  }, [notice])

  async function handleSave(input: ProfileInput) {
    try {
      await save(input)
      setEditing(false)
      setNotice({ kind: 'success', text: 'Profile saved' })
    } catch (e) {
      setNotice({ kind: 'danger', text: extractError(e) })
    }
  }

  async function handlePick(file: File) {
    try {
      await uploadAvatar(file)
      setNotice({ kind: 'success', text: 'Photo updated' })
    } catch (e) {
      setNotice({ kind: 'danger', text: extractError(e) })
    }
  }

  async function handleRemove() {
    try {
      await removeAvatar()
      setNotice({ kind: 'success', text: 'Photo removed' })
    } catch (e) {
      setNotice({ kind: 'danger', text: extractError(e) })
    }
  }

  const header = (
    <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-h-11 items-center gap-1.5 text-caption text-fg-muted">
        <span>My Account /</span>
        <span className="flex items-center gap-1.5 text-fg">
          <IconUser className="size-3.5" aria-hidden="true" />
          Profile
        </span>
      </nav>
      <button
        type="button"
        onClick={() => setConfirmSignOut(true)}
        className="relative shrink-0 rounded-full p-1 text-fg-secondary transition-colors duration-150 hover:text-danger focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label="Sign out"
        title="Sign out"
      >
        <IconLogout className="size-6" />
      </button>
    </header>
  )

  if (loading) {
    return (
      <section aria-busy="true">
        {header}
        <div className="skeleton h-[120px] lg:h-[160px]" />
        <div className="mx-auto mt-6 flex w-full max-w-[720px] flex-col items-center gap-4 lg:mt-8">
          <div className="skeleton size-24 rounded-full ring-4 ring-background lg:size-[120px]" />
          <div className="skeleton h-8 w-56 rounded-pill" />
          <div className="skeleton h-4 w-64 max-w-full rounded-pill" />
        </div>
        <div className="glass-card mx-auto mt-8 max-w-[720px] rounded-card p-5 lg:p-6">
          <div className="skeleton h-5 w-40 rounded-pill" />
          <div className="mt-5 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-4 w-full rounded-pill" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Page-level error only when there is nothing to show (e.g. first load).
  if (error && !profile) {
    return (
      <section>
        {header}
        <div role="alert" className="glass-card mx-auto mt-6 max-w-[720px] rounded-card p-6 text-center">
          <p className="text-body text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="glass-pill mt-4 h-12 rounded-pill px-5 text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised active:scale-95"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <section>
      {header}
      <ProfileBanner
        name={profile?.full_name ?? null}
        email={email}
        emailConfirmed={emailConfirmed}
        avatarPath={profile?.avatar_path ?? null}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onPickFile={(file) => void handlePick(file)}
        onRemove={() => void handleRemove()}
        notice={notice}
      />
      <div className="mx-auto mt-4 w-full max-w-[720px] lg:mt-6">
        <ProfileDetails
          profile={profile}
          email={email}
          editing={editing}
          onEdit={() => setEditing(true)}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
          saving={saving}
        />
      </div>
      {/* Toast: pinned under the page header, NOT the viewport bottom —
          a warning at the bottom edge stayed unseen unless the user scrolled
          all the way down (user report). */}
      {/* (Toast removed from viewport positioning — it renders over the
          name + verified-badge row via ProfileBanner's `notice` slot.) */}
      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
        description="You'll need to sign in again to see your habits."
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        danger
        onConfirm={signOut}
      />
    </section>
  )
}
