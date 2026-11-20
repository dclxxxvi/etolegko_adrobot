import { AlertCircleIcon, RotateCwIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'

interface ErrorStateProps {
  title?: string
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  action?: ReactNode
}

export function ErrorState({
  title = 'Failed to load data',
  error,
  onRetry,
  retrying,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircleIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            <RotateCwIcon className={retrying ? 'animate-spin' : undefined} />
            Retry
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
