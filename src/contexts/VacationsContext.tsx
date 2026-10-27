import { createContext, useContext, type ReactNode } from 'react'
import { useVacations, type UseVacationsResult } from '../hooks/useVacations'

interface VacationsProviderProps {
  children: ReactNode
}

/** One shared vacation-period list for the whole signed-in app (Today banner,
 *  hero, tiles, stats and the Settings card all read the same rows). Mounted
 *  inside RequireAuth next to HabitsProvider. */
const VacationsContext = createContext<UseVacationsResult | null>(null)

export function VacationsProvider({ children }: VacationsProviderProps) {
  const vacations = useVacations()
  return (
    <VacationsContext.Provider value={vacations}>{children}</VacationsContext.Provider>
  )
}

export function useVacationsContext() {
  const ctx = useContext(VacationsContext)
  if (!ctx) throw new Error('useVacationsContext must be used within a VacationsProvider')
  return ctx
}
