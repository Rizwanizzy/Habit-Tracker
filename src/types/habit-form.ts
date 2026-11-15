/** Shared form shape for the habit create/edit page. Both the desktop
 *  layout (HabitForm page, lg+) and the phone layout (HabitFormMobile,
 *  below lg) drive ONE FormState — the stringly-typed draft the page
 *  keeps in React state and maps into HabitInput on submit. */
import type { ScheduleMode } from '../lib/schedule'

export interface FormState {
  name: string
  emoji: string
  type: 'boolean' | 'numeric'
  target: string
  unit: string
  freq_times: string
  freq_days: string
  color: string
  /** Repeat mode ('' only while the schedule-capability probe is pending —
   *  pre-migration databases keep the plain frequency form). 'legacy' is the
   *  frozen schedule of pre-scheduling habits, shown without conversion. */
  schedule_mode: ScheduleMode | ''
  /** Weekday mask for the weekdays mode (7-bit, Monday = 1 … Sunday = 64). */
  scheduled_days: number
  /** Interval / weekly-target drafts, same string convention as freq_*. */
  interval_days: string
  weekly_target: string
}

/** Blank draft for the create route. */
export const FORM_BLANK: FormState = {
  name: '',
  emoji: '',
  type: 'boolean',
  target: '1',
  unit: '',
  freq_times: '1',
  freq_days: '1',
  color: '#3B82F6',
  schedule_mode: 'daily',
  scheduled_days: 31, // Mon–Fri pre-selected for the weekdays mode
  interval_days: '2',
  weekly_target: '1',
}
