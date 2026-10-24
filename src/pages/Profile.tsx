import { useEffect, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { extractError } from '../hooks/useHabits'
import type { ProfileInput } from '../lib/profile'
import { ProfileBanner } from '../components/ProfileBanner'
import { ProfileDetails } from '../components/ProfileDetails'
import { IconUser } from '../components/icons'

type Notice = { kind: 'success' | 'danger'; text: string } | null

/** Profile page (DESIGN.md §11): breadcrumb header with an "Edit profile"
 *  pill, glass banner + overlapping avatar, and the Personal details card.
 *  Owns edit mode, toasts, and the loading / error states. */
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
  } = useProfile()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
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
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-h-11 items-center gap-1.5 text-caption text-fg-muted">
        <span>My Account /</span>
        <span className="flex items-center gap-1.5 text-fg">
          <IconUser className="size-3.5" aria-hidden="true" />
          Profile
        </span>
      </nav>
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="bg-accent-gradient glow-accent inline-flex h-12 shrink-0 items-center rounded-pill px-5 text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 active:scale-95"
        >
          Edit profile
        </button>
      )}
    </header>
  )

  if (loading) {
    return (
      <section aria-busy="true">
        {header}
        <div className="skeleton h-[120px] rounded-card lg:h-[160px]" />
        <div className="mx-auto -mt-12 flex w-full max-w-[720px] flex-col items-center gap-3 lg:mt-[-60px]">
          <div className="skeleton size-24 rounded-full ring-4 ring-bg-base lg:size-[120px]" />
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
      />
      <div className="mx-auto mt-6 w-full max-w-[720px] lg:mt-8">
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
      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6"
        >
          <p
            className={`glass-pill rounded-pill px-5 py-2.5 text-body font-medium ${
              notice.kind === 'success' ? 'text-success' : 'text-danger'
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}
    </section>
  )
}
