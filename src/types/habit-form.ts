/** Shared form shape for the habit create/edit page. Both the desktop
 *  layout (HabitForm page, lg+) and the phone layout (HabitFormMobile,
 *  below lg) drive ONE FormState — the stringly-typed draft the page
 *  keeps in React state and maps into HabitInput on submit. */
export interface FormState {
  name: string
  emoji: string
  type: 'boolean' | 'numeric'
  target: string
  unit: string
  freq_times: string
  freq_days: string
  color: string
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
}
