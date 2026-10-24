import { createContext, useContext } from 'react'
import { useProfile, type UseProfileResult } from '../hooks/useProfile'

interface ProfileProviderProps {
  children: React.ReactNode
}

const ProfileContext = createContext<UseProfileResult | null>(null)

export function ProfileProvider({ children }: ProfileProviderProps) {
  const profile = useProfile()
  return (
    <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
  )
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfileContext must be used within a ProfileProvider')
  return ctx
}
