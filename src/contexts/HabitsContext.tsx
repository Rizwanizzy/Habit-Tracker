import { createContext, useContext } from 'react'
import { useHabits, type UseHabitsResult } from '../hooks/useHabits'

interface HabitsProviderProps {
  children: React.ReactNode
}

/** One shared habit list for the whole signed-in app (all habits, archived
 *  included; Today, the rings, Overview and Settings filter client-side).
 *  Every page reads this so check-ins, archive/reorder and creates are
 *  visible everywhere at once. */
const HabitsContext = createContext<UseHabitsResult | null>(null)

export function HabitsProvider({ children }: HabitsProviderProps) {
  const habits = useHabits({ includeArchived: true })
  return (
    <HabitsContext.Provider value={habits}>{children}</HabitsContext.Provider>
  )
}

export function useHabitsContext() {
  const ctx = useContext(HabitsContext)
  if (!ctx) throw new Error('useHabitsContext must be used within a HabitsProvider')
  return ctx
}
