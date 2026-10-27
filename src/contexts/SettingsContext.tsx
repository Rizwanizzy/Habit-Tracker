import { createContext, useContext, type ReactNode } from 'react'
import { useUserSettings, type UserSettings } from '../hooks/useUserSettings'

const SettingsContext = createContext<UserSettings | null>(null)

/** Shares the day-start setting across the app (mounted inside RequireAuth,
 *  wrapping HabitsProvider so habit created_at conversions can use it too). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useUserSettings()
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSettings(): UserSettings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
