import { WorkflowIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import type { Stream } from '@/lib/types'

export function StreamHeaderRow({ stream, children }: { stream: Stream; children?: ReactNode }) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={5} className="h-12 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <WorkflowIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Stream:</span>
            <span className="truncate font-medium">
              Flow {stream.position}: {stream.name}
            </span>
          </div>
          {children}
        </div>
      </TableCell>
    </TableRow>
  )
}
