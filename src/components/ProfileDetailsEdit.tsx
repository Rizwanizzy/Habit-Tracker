import { useEffect, useRef, useState } from 'react'
import type { Gender, Profile, ProfileErrors, ProfileInput } from '../lib/profile'
import { normalizeBio, validateProfile } from '../lib/profile'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { RangeSwitch } from './RangeSwitch'

type Draft = {
  full_name: string
  bio: string
  date_of_birth: string
  gender: Gender
  nationality: string
  country: string
  address: string
  phone: string
}

const GENDER_OPTIONS = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Not said' },
]

function draftFrom(profile: Profile | null): Draft {
  return {
    full_name: profile?.full_name ?? '',
    bio: profile?.bio ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    gender: profile?.gender ?? 'prefer_not_to_say',
    nationality: profile?.nationality ?? '',
    country: profile?.country ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
  }
}

/** Personal details card, edit mode (DESIGN.md §11):
 *  - Phones (below lg): single column.
 *  - Desktop (lg and up): 2 columns with no blank cells
 *    (Full name | Date of birth; Gender span 2; Nationality | Country; Phone span 2; Address span 2).
 *  - Inline errors stay under their own field with items-start so they never shift adjacent inputs.
 *  - Email row is removed. */
export function ProfileDetailsEdit({
  profile,
  saving,
  focusBio = false,
  onCancel,
  onSave,
}: {
  profile: Profile | null
  saving: boolean
  focusBio?: boolean
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(profile))
  const [errors, setErrors] = useState<ProfileErrors>({})
  const bioInputRef = useRef<HTMLTextAreaElement>(null)
  // DOB validation and its date-input max use the logical today.
  const today = useLogicalToday()

  useEffect(() => {
    if (focusBio && bioInputRef.current) {
      bioInputRef.current.focus()
    }
  }, [focusBio])

  async function handleSave() {
    const input: ProfileInput = {
      full_name: draft.full_name.trim() || null,
      bio: normalizeBio(draft.bio),
      date_of_birth: draft.date_of_birth || null,
      gender: draft.gender,
      nationality: draft.nationality.trim() || null,
      country: draft.country.trim() || null,
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
      avatar_path: profile?.avatar_path ?? null,
    }
    const check = validateProfile(input, today)
    setErrors(check.errors)
    if (!check.valid) return
    try {
      await onSave(input)
    } catch {
      /* surfaced by the page as a toast */
    }
  }

  return (
    <>
      {/* Sticky header: Save/Cancel stay visible while scrolling. */}
      <div className="glass-pill sticky top-2 z-20 flex items-center justify-between gap-2 rounded-pill px-3 py-2 lg:top-4">
        <h2 className="text-base font-semibold">Personal details</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-12 items-center rounded-pill px-4 text-body font-medium text-fg transition-colors duration-150 hover:bg-surface-raised active:scale-95 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-accent-gradient glow-accent inline-flex h-12 items-center rounded-pill px-5 text-body font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:brightness-110 active:scale-95 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-6 lg:items-start">
        {/* Field 1: Quote (Bio, spans both columns) */}
        <div className="col-span-1 lg:col-span-2 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="profile-bio" className="text-caption text-fg-secondary">
              Quote
            </label>
            <span className="text-caption text-fg-muted font-mono">
              {Array.from(draft.bio).length}/140
            </span>
          </div>
          <textarea
            id="profile-bio"
            ref={bioInputRef}
            rows={3}
            value={draft.bio}
            placeholder="A line that keeps you going"
            disabled={saving}
            className="input-field h-auto min-h-[5rem] py-2.5 resize-none leading-relaxed"
            onChange={(e) => {
              const singleLine = e.target.value.replace(/[\r\n]+/g, ' ')
              setDraft((d) => ({ ...d, bio: singleLine }))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
          />
          {errors.bio && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.bio}
            </p>
          )}
        </div>

        {/* Row 1: Full name | Date of birth */}
        <div className="col-span-1 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <label htmlFor="profile-full_name" className="text-caption text-fg-secondary block mb-1.5">
            Full name
          </label>
          <input
            id="profile-full_name"
            type="text"
            value={draft.full_name}
            placeholder="Your name"
            disabled={saving}
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
          />
          {errors.full_name && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.full_name}
            </p>
          )}
        </div>

        <div className="col-span-1 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <label htmlFor="profile-date_of_birth" className="text-caption text-fg-secondary block mb-1.5">
            Date of birth
          </label>
          <input
            id="profile-date_of_birth"
            type="date"
            value={draft.date_of_birth}
            max={today}
            disabled={saving}
            className="input-field date-field min-w-0"
            onChange={(e) => setDraft((d) => ({ ...d, date_of_birth: e.target.value }))}
          />
          {errors.date_of_birth && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.date_of_birth}
            </p>
          )}
        </div>

        {/* Row 2: Gender (span 2) */}
        <div className="col-span-1 lg:col-span-2 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <span className="text-caption text-fg-secondary block mb-1.5">Gender</span>
          <RangeSwitch
            options={GENDER_OPTIONS}
            value={draft.gender}
            ariaLabel="Gender"
            onChange={(key) => setDraft((d) => ({ ...d, gender: key as Gender }))}
          />
          {errors.gender && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.gender}
            </p>
          )}
        </div>

        {/* Row 3: Nationality | Country */}
        <div className="col-span-1 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <label htmlFor="profile-nationality" className="text-caption text-fg-secondary block mb-1.5">
            Nationality
          </label>
          <input
            id="profile-nationality"
            type="text"
            value={draft.nationality}
            placeholder="e.g. Indian"
            disabled={saving}
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, nationality: e.target.value }))}
          />
          {errors.nationality && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.nationality}
            </p>
          )}
        </div>

        <div className="col-span-1 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <label htmlFor="profile-country" className="text-caption text-fg-secondary block mb-1.5">
            Country
          </label>
          <input
            id="profile-country"
            type="text"
            value={draft.country}
            placeholder="e.g. India"
            disabled={saving}
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
          />
          {errors.country && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.country}
            </p>
          )}
        </div>

        {/* Row 4: Phone (span 2) */}
        <div className="col-span-1 lg:col-span-2 border-b border-dashed border-border py-3 lg:py-3.5 min-w-0">
          <label htmlFor="profile-phone" className="text-caption text-fg-secondary block mb-1.5">
            Phone number
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={draft.phone}
            placeholder="+91 …"
            disabled={saving}
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
          {errors.phone && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.phone}
            </p>
          )}
        </div>

        {/* Row 5: Address (span 2) */}
        <div className="col-span-1 lg:col-span-2 pt-3 lg:pt-3.5 min-w-0">
          <label htmlFor="profile-address" className="text-caption text-fg-secondary block mb-1.5">
            Address
          </label>
          <input
            id="profile-address"
            type="text"
            value={draft.address}
            placeholder="Country, city or region"
            disabled={saving}
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
          />
          {errors.address && (
            <p role="alert" className="text-body text-danger mt-1">
              {errors.address}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
