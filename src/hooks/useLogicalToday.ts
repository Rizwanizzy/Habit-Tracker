import { useEffect, useState } from 'react'
import { logicalToday, msUntilNextDayStart } from '../lib/dates'
import { now } from '../lib/clock'
import { useSettings } from '../contexts/SettingsContext'

/** The current logical date (YYYY-MM-DD) as a reactive value.
 *
 *  Recomputed when the logical day actually rolls over (a setTimeout armed at
 *  `msUntilNextDayStart`, re-armed after every fire) and on `visibilitychange`
 *  / window focus — phones suspend timers while backgrounded, so returning to
 *  the foreground must not keep showing yesterday. Reads the clock through
 *  clock.now() so dev time-travel works. */
export function useLogicalToday(): string {
  const { dayStartHour } = useSettings()
  const [today, setToday] = useState(() => logicalToday(now(), dayStartHour))

  useEffect(() => {
    let timer: number | undefined
    const update = () => {
      setToday(logicalToday(now(), dayStartHour))
      window.clearTimeout(timer)
      timer = window.setTimeout(update, msUntilNextDayStart(now(), dayStartHour))
    }
    const onWake = () => update()
    update()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [dayStartHour])

  return today
}
