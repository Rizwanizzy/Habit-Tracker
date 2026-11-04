import type { Gender, Profile } from '../lib/profile'

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

function Cell({
  label,
  value,
  className = '',
}: {
  label: string
  value: string | null | undefined
  className?: string
}) {
  const hasValue = value != null && value.trim() !== ''
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-caption text-fg-secondary">{label}</dt>
      {hasValue ? (
        <dd className="text-body min-w-0 break-words text-fg mt-0.5">{value}</dd>
      ) : (
        <dd className="text-body text-fg-muted mt-0.5">Not added</dd>
      )}
    </div>
  )
}

/** Personal details card, display mode (DESIGN.md §11):
 *  2-column grid at all widths (falling back to 1 column below 340px),
 *  with continuous dashed dividers between rows. */
export function ProfileDetailsDisplay({
  profile,
  onEdit,
}: {
  profile: Profile | null
  onEdit: () => void
}) {
  const dob = formatDob(profile?.date_of_birth ?? null)
  const gender = profile?.gender ? GENDER_LABELS[profile.gender] : null

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 lg:pb-4">
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
        {/* Row 1: Full name | Date of birth */}
        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
          <Cell label="Full name" value={profile?.full_name ?? null} />
          <Cell label="Date of birth" value={dob} className="max-[339px]:mt-2.5" />
        </div>

        {/* Row 2: Gender | Nationality */}
        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
          <Cell label="Gender" value={gender} />
          <Cell label="Nationality" value={profile?.nationality ?? null} className="max-[339px]:mt-2.5" />
        </div>

        {/* Row 3: Country | Phone number */}
        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-4 lg:gap-x-8 border-b border-dashed border-border py-3 lg:py-3.5">
          <Cell label="Country" value={profile?.country ?? null} />
          <Cell label="Phone number" value={profile?.phone ?? null} className="max-[339px]:mt-2.5" />
        </div>

        {/* Row 4: Address (spans both columns) */}
        <div className="pt-3 lg:pt-3.5">
          <Cell label="Address" value={profile?.address ?? null} />
        </div>
      </dl>
    </>
  )
}
