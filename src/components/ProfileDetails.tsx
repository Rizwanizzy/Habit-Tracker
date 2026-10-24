import type { Profile, ProfileInput } from '../lib/profile'
import { ProfileDetailsDisplay } from './ProfileDetailsDisplay'
import { ProfileDetailsEdit } from './ProfileDetailsEdit'

interface Props {
  profile: Profile | null
  email: string | null
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
  saving: boolean
}

/** Personal details card (DESIGN.md §11): 28px-radius glass card holding the
 *  display rows or the in-place edit form, max 720px on desktop. */
export function ProfileDetails({
  profile,
  email,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
}: Props) {
  return (
    <section aria-label="Personal details card" className="glass-card rounded-card p-5 lg:p-6">
      {editing ? (
        <ProfileDetailsEdit
          profile={profile}
          email={email}
          saving={saving}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <ProfileDetailsDisplay profile={profile} email={email} onEdit={onEdit} />
      )}
    </section>
  )
}
