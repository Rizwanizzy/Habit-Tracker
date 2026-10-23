import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Habit } from '../lib/score'

interface Props {
  habit: Habit
  done: boolean
  streak: number
  value: number | null
  onToggle: () => void
  onLogValue: (value: number) => void
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

/** One-tap habit row: colored checkbox, habit-colored name, streak badge. */
export function HabitRow({ habit, done, streak, value, onToggle, onLogValue }: Props) {
  const color = habit.color ?? '#3B82F6'
  const isNumeric = habit.type === 'numeric'
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function submitValue() {
    const v = Number(input)
    if (Number.isFinite(v) && v >= 0) {
      onLogValue(v)
      setEditing(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submitValue()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <li className="flex min-h-[68px] items-center gap-1 rounded-card border border-border bg-surface-raised px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`Mark ${habit.name} for the selected date`}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full transition-transform duration-150 active:scale-95"
      >
        <span
          className="grid size-6 place-items-center rounded-full border-2 transition-colors duration-150"
          style={{
            borderColor: done ? color : 'var(--border)',
            backgroundColor: done ? color : 'transparent',
          }}
        >
          {done && <CheckIcon />}
        </span>
      </button>

      <Link
        to={`/habits/${habit.id}`}
        className="text-habit-name min-w-0 flex-1 truncate hover:underline decoration-1 underline-offset-2"
        style={{ color }}
      >
        {habit.name}
      </Link>

      {isNumeric &&
        (editing ? (
          <span className="flex shrink-0 items-center gap-1">
            <input
              autoFocus
              inputMode="decimal"
              value={input}
              placeholder={String(habit.target)}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label={`Value for ${habit.name}`}
              className="h-11 w-20 rounded-button border border-border bg-surface px-2 text-caption text-fg"
            />
            <button
              type="button"
              onClick={submitValue}
              className="h-11 rounded-button px-2 text-body font-semibold text-accent"
            >
              Save
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInput(value != null ? String(value) : '')
              setEditing(true)
            }}
            className="text-caption h-11 shrink-0 rounded-full bg-surface px-3 font-semibold transition-colors duration-150 hover:bg-surface/70"
            style={{ color }}
            aria-label={`Log exact value for ${habit.name}`}
          >
            {value != null ? `${value} ${habit.unit ?? ''}`.trim() : 'Set value'}
          </button>
        ))}

      <Link
        to={`/habits/${habit.id}/edit`}
        aria-label={`Edit ${habit.name}`}
        className="grid h-11 w-11 shrink-0 place-items-center text-fg-muted transition-colors duration-150 hover:text-fg"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </Link>

      <span
        title="Current streak"
        className="text-caption inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2 font-semibold text-fg-secondary"
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {streak}
      </span>
    </li>
  )
}