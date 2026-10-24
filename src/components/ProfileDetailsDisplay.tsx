import type { Gender, Profile } from '../lib/profile'
import { IconLock } from './icons'

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
}

/** Date of birth as a local, readable date (never pushed through UTC). */
function formatDob(value: string | null): string | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-dashed border-border py-4 sm:grid-cols-[35%_1fr] sm:items-center sm:gap-2">
      <dt className="text-caption text-fg-secondary">{label}</dt>
      {value != null && value.trim() !== '' ? (
        <dd className="text-body min-w-0 break-words text-fg">{value}</dd>
      ) : (
        <dd className="text-body text-fg-muted">Not added</dd>
      )}
    </div>
  )
}

/** Personal details card, display mode (DESIGN.md §11): header separated by a
 *  1px border, then 35%/65% label/value rows with dashed dividers. */
export function ProfileDetailsDisplay({
  profile,
  email,
  onEdit,
}: {
  profile: Profile | null
  email: string | null
  onEdit: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
        <h2 className="text-base font-semibold">Personal details</h2>
        <button
          type="button"
          onClick={onEdit}
          className="glass-pill inline-flex h-9 items-center rounded-pill px-3 text-body font-medium text-fg-secondary transition-colors duration-150 hover:text-fg hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Edit
        </button>
      </div>
      <dl>
        <Row label="Full name" value={profile?.full_name ?? null} />
        <Row label="Date of birth" value={formatDob(profile?.date_of_birth ?? null)} />
        <Row label="Gender" value={profile?.gender ? GENDER_LABELS[profile.gender] : null} />
        <Row label="Nationality" value={profile?.nationality ?? null} />
        <Row label="Country" value={profile?.country ?? null} />
        <Row label="Address" value={profile?.address ?? null} />
        <Row label="Phone number" value={profile?.phone ?? null} />
        {/* Email comes from the auth session and is read-only. */}
        <div className="grid grid-cols-1 gap-0.5 border-b border-dashed border-border py-4 sm:grid-cols-[35%_1fr] sm:items-center sm:gap-2">
          <dt className="text-caption text-fg-secondary">Email</dt>
          <dd className="text-body flex min-w-0 items-center gap-1.5 text-fg">
            <IconLock className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="truncate">{email ?? '—'}</span>
          </dd>
        </div>
      </dl>
    </>
  )
}
