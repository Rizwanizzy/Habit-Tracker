import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractError } from '../hooks/useHabits'
import { getSupabase } from '../lib/supabase'
import type { ProfileInput } from '../lib/profile'
import { ProfileBanner } from '../components/ProfileBanner'
import { ProfileDetails } from '../components/ProfileDetails'
import { JourneyCard } from '../components/JourneyCard'
import { MilestonesCard } from '../components/MilestonesCard'
import { IconUser, IconLogout } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useProfileContext } from '../contexts/ProfileContext'
import { useHabitsContext } from '../contexts/HabitsContext'
import { useLifetimeStats } from '../hooks/useLifetimeStats'

type Notice = { kind: 'success' | 'danger'; text: string } | null

/** Profile page (DESIGN.md §11): breadcrumb header, glass banner + avatar on
 *  top of the grid, Personal details card on the left (lg:7/12) and
 *  Your journey + Milestones stacked on the right (lg:5/12). */
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
  const { habits } = useHabitsContext()
  const { stats, loading: statsLoading, error: statsError, reload: reloadStats } = useLifetimeStats()
  const [editing, setEditing] = useState(false)
  const [focusBio, setFocusBio] = useState(false)
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
          <div className="skeleton h-3.5 w-44 rounded-pill" />
        </div>

        <div className="mx-auto mt-4 w-full max-w-[1140px] flex flex-col gap-3 lg:gap-6 lg:mt-6">
          {/* Skeleton Full-width Journey Card */}
          <div className="w-full">
            <div className="glass-card rounded-card p-4 sm:p-5 lg:p-6">
              <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border">
                <div className="skeleton h-5 w-28 rounded-pill" />
                <div className="skeleton h-3 w-16 rounded-pill" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="glass-card rounded-tile p-4 sm:p-5">
                    <div className="skeleton h-3 w-16 rounded-pill" />
                    <div className="skeleton mt-2 h-7 w-20 rounded-pill sm:h-8" />
                    <div className="skeleton mt-2 h-3.5 w-24 rounded-pill" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skeleton Subgrid */}
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6">
            <div className="order-2 lg:order-1 lg:col-span-7 min-w-0">
              <div className="glass-card rounded-card h-full p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between border-b border-border pb-3 lg:pb-4">
                  <div className="skeleton h-5 w-36 rounded-pill" />
                  <div className="skeleton h-9 w-16 rounded-pill" />
                </div>
                <div>
                  <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
                    <div>
                      <div className="skeleton h-3.5 w-16 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-32 rounded-pill" />
                    </div>
                    <div className="max-[339px]:mt-2.5">
                      <div className="skeleton h-3.5 w-20 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-28 rounded-pill" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
                    <div>
                      <div className="skeleton h-3.5 w-14 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-20 rounded-pill" />
                    </div>
                    <div className="max-[339px]:mt-2.5">
                      <div className="skeleton h-3.5 w-18 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-24 rounded-pill" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
                    <div>
                      <div className="skeleton h-3.5 w-14 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-24 rounded-pill" />
                    </div>
                    <div className="max-[339px]:mt-2.5">
                      <div className="skeleton h-3.5 w-24 rounded-pill" />
                      <div className="skeleton mt-2 h-4 w-32 rounded-pill" />
                    </div>
                  </div>

                  <div className="pt-3 lg:pt-3.5">
                    <div className="skeleton h-3.5 w-16 rounded-pill" />
                    <div className="skeleton mt-2 h-4 w-48 rounded-pill" />
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-5 min-w-0">
              <div className="glass-card rounded-card h-full p-4 sm:p-5 lg:p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border">
                  <div className="skeleton h-5 w-24 rounded-pill" />
                  <div className="skeleton h-3 w-12 rounded-pill" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="skeleton size-11 rounded-full" />
                      <div className="skeleton mt-1.5 h-3.5 w-6 rounded-pill" />
                      <div className="skeleton mt-1 h-3 w-10 rounded-pill" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
        bio={profile?.bio ?? null}
        avatarPath={profile?.avatar_path ?? null}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onPickFile={(file) => void handlePick(file)}
        onRemove={() => void handleRemove()}
        onAddBio={() => {
          setEditing(true)
          setFocusBio(true)
        }}
        notice={notice}
      />
      <div className="mx-auto mt-4 w-full max-w-[1140px] flex flex-col gap-3 lg:gap-6 lg:mt-6">
        {/* Full-width Journey Card on both mobile and desktop */}
        <div className="w-full">
          <JourneyCard
            stats={stats}
            loading={statsLoading}
            error={statsError}
            onRetry={() => void reloadStats()}
            habits={habits}
          />
        </div>

        {/* 2-column grid on desktop (lg:7/12 Personal Details, lg:5/12 Milestones) with items-stretch.
            On mobile: Milestones (order-1) comes before Personal Details (order-2). */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6">
          <div className="order-2 lg:order-1 lg:col-span-7 min-w-0">
            <ProfileDetails
              profile={profile}
              editing={editing}
              focusBio={focusBio}
              onEdit={() => {
                setEditing(true)
                setFocusBio(false)
              }}
              onCancel={() => {
                setEditing(false)
                setFocusBio(false)
              }}
              onSave={handleSave}
              saving={saving}
            />
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5 min-w-0">
            <MilestonesCard stats={stats} loading={statsLoading} />
          </div>
        </div>
      </div>
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
