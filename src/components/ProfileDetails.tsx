import type { Profile, ProfileInput } from '../lib/profile'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { ProfileDetailsDisplay } from './ProfileDetailsDisplay'
import { ProfileDetailsEdit } from './ProfileDetailsEdit'
import { ProfileEditModal } from './ProfileEditModal'

interface Props {
  profile: Profile | null
  editing: boolean
  focusBio?: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (input: ProfileInput) => Promise<void>
  saving: boolean
}

/** Personal details card (DESIGN.md §11): 28px-radius glass card.
 *  - Phones (<1024px): inline editing inside the card.
 *  - Desktop (≥1024px): modal edit flow via ProfileEditModal while the card behind stays in display mode. */
export function ProfileDetails({
  profile,
  editing,
  focusBio = false,
  onEdit,
  onCancel,
  onSave,
  saving,
}: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <>
      <section
        aria-label="Personal details card"
        className="glass-card rounded-card p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-start"
      >
        {editing && !isDesktop ? (
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

      {editing && isDesktop && (
        <ProfileEditModal
          open={editing}
          profile={profile}
          saving={saving}
          focusBio={focusBio}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    </>
  )
}
