import { useState } from 'react'
import type { Gender, Profile, ProfileErrors, ProfileInput } from '../lib/profile'
import { validateProfile } from '../lib/profile'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { RangeSwitch } from './RangeSwitch'
import { IconLock } from './icons'

type Draft = {
  full_name: string
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

const FIELDS: { key: keyof Omit<Draft, 'gender'>; label: string; type: 'text' | 'date' | 'tel'; placeholder: string }[] = [
  { key: 'full_name', label: 'Full name', type: 'text', placeholder: 'Your name' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date', placeholder: '' },
  { key: 'nationality', label: 'Nationality', type: 'text', placeholder: 'e.g. Indian' },
  { key: 'country', label: 'Country', type: 'text', placeholder: 'e.g. India' },
  { key: 'address', label: 'Address', type: 'text', placeholder: 'Country, city or region' },
  { key: 'phone', label: 'Phone number', type: 'tel', placeholder: '+91 …' },
]

function draftFrom(profile: Profile | null): Draft {
  return {
    full_name: profile?.full_name ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    gender: profile?.gender ?? 'prefer_not_to_say',
    nationality: profile?.nationality ?? '',
    country: profile?.country ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
  }
}

/** Personal details card, edit mode (DESIGN.md §11): rows become inputs in
 *  place; Save/Cancel live in the card header and stay visible on scroll. */
export function ProfileDetailsEdit({
  profile,
  email,
  saving,
  onCancel,
  onSave,
}: {
  profile: Profile | null
  email: string | null
  saving: boolean
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(profile))
  const [errors, setErrors] = useState<ProfileErrors>({})
  // DOB validation and its date-input max use the logical today.
  const today = useLogicalToday()

  async function handleSave() {
    const input: ProfileInput = {
      full_name: draft.full_name.trim() || null,
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

      <div className="mt-5">
        {FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-1 gap-1.5 border-b border-dashed border-border py-4">
            <label htmlFor={`profile-${f.key}`} className="text-caption text-fg-secondary">
              {f.label}
            </label>
            <input
              id={`profile-${f.key}`}
              type={f.type}
              value={draft[f.key]}
              placeholder={f.placeholder}
              max={f.type === 'date' ? today : undefined}
              disabled={saving}
              className="input-field"
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
            {errors[f.key] && (
              <p role="alert" className="text-body text-danger">
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}

        {/* Gender: segmented control (null counts as "prefer not to say"). */}
        <div className="grid grid-cols-1 gap-1.5 border-b border-dashed border-border py-4">
          <span className="text-caption text-fg-secondary">Gender</span>
          <RangeSwitch
            options={GENDER_OPTIONS}
            value={draft.gender}
            ariaLabel="Gender"
            onChange={(key) => setDraft((d) => ({ ...d, gender: key as Gender }))}
          />
          {errors.gender && (
            <p role="alert" className="text-body text-danger">
              {errors.gender}
            </p>
          )}
        </div>

        {/* Email is read-only; it lives in the auth session, not in profiles. */}
        <div className="grid grid-cols-1 gap-1.5 py-4">
          <span className="text-caption text-fg-secondary">Email</span>
          <div className="input-field flex cursor-not-allowed items-center gap-2 text-fg-secondary" aria-disabled="true">
            <IconLock className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="truncate">{email ?? '—'}</span>
          </div>
        </div>
      </div>
    </>
  )
}
