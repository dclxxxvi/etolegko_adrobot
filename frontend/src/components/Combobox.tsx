import { CheckIcon, ChevronsUpDownIcon, Loader2Icon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Extra text used for search and shown before the label */
  prefix?: ReactNode
  keywords?: string[]
}

interface ComboboxProps {
  id?: string
  value: string | null
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  disabled?: boolean
  invalid?: boolean
  className?: string
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing found',
  loading,
  disabled,
  invalid,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-invalid={invalid || undefined}
            disabled={disabled || loading}
            className={cn('w-full justify-between font-normal', className)}
          />
        }
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? (
            <>
              {selected.prefix && <span className="mr-1.5">{selected.prefix}</span>}
              {selected.label}
            </>
          ) : loading ? (
            'Loading…'
          ) : (
            placeholder
          )}
        </span>
        {loading ? (
          <Loader2Icon className="animate-spin opacity-50" />
        ) : (
          <ChevronsUpDownIcon className="opacity-50" />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.prefix && <span>{option.prefix}</span>}
                  <span className="truncate">{option.label}</span>
                  <CheckIcon
                    className={cn('ml-auto', option.value === value ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
