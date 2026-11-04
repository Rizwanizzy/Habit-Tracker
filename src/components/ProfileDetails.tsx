import type { Profile, ProfileInput } from '../lib/profile'
import { ProfileDetailsDisplay } from './ProfileDetailsDisplay'
import { ProfileDetailsEdit } from './ProfileDetailsEdit'

interface Props {
  profile: Profile | null
  editing: boolean
  focusBio?: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
  saving: boolean
}

/** Personal details card (DESIGN.md §11): 28px-radius glass card holding the
 *  display rows or the in-place edit form, max 720px on desktop. */
export function ProfileDetails({
  profile,
  editing,
  focusBio = false,
  onEdit,
  onCancel,
  onSave,
  saving,
}: Props) {
  return (
    <section aria-label="Personal details card" className="glass-card rounded-card p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-start">
      {editing ? (
        <ProfileDetailsEdit
          profile={profile}
          saving={saving}
          focusBio={focusBio}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <ProfileDetailsDisplay profile={profile} onEdit={onEdit} />
      )}
    </section>
  )
}
