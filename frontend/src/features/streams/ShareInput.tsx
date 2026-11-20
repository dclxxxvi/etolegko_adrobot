import { useState } from 'react'
import { clampShare } from '@/lib/shares'
import { cn } from '@/lib/utils'

interface ShareInputProps {
  value: number
  onCommit: (value: number) => void
  disabled?: boolean
  highlighted?: boolean
  label: string
}

/** Percent input that commits on blur / Enter, so typing does not reshuffle other rows. */
export function ShareInput({ value, onCommit, disabled, highlighted, label }: ShareInputProps) {
  const [text, setText] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    setText(String(value))
  }

  const commit = () => {
    const next = clampShare(Number(text))
    setText(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <div
      className={cn(
        'flex h-7 w-16 items-center rounded-md border border-input bg-background pr-2 text-sm tabular-nums transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        highlighted && 'border-primary/30 bg-primary/5',
        disabled && 'border-transparent bg-transparent',
      )}
    >
      <input
        aria-label={label}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setText(String(value))
        }}
        className="w-full min-w-0 bg-transparent pl-2 text-right outline-none disabled:cursor-default"
      />
      <span className="pl-0.5 text-muted-foreground">%</span>
    </div>
  )
}
