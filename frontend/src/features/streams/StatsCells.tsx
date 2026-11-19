import { Sparkline } from '@/components/Sparkline'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Metrics } from '@/lib/types'

export interface StatsState {
  loading: boolean
  error: boolean
  days: string[]
}

const number = new Intl.NumberFormat('en-US')
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Unavailable() {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help text-muted-foreground/60" />}>
        —
      </TooltipTrigger>
      <TooltipContent>Statistics are unavailable</TooltipContent>
    </Tooltip>
  )
}

/** Renders the Stats and Trends cells for one row. */
export function StatsCells({
  metrics,
  state,
  muted,
}: {
  metrics: Metrics | undefined
  state: StatsState
  muted?: boolean
}) {
  if (state.loading) {
    return (
      <>
        <TableCell>
          <Skeleton className="h-4 w-36" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-24" />
        </TableCell>
      </>
    )
  }
  if (state.error) {
    return (
      <>
        <TableCell>
          <Unavailable />
        </TableCell>
        <TableCell>
          <Unavailable />
        </TableCell>
      </>
    )
  }

  const m = metrics ?? {
    clicks: 0,
    conversions: 0,
    revenue: 0,
    daily_clicks: state.days.map(() => 0),
  }
  return (
    <>
      <TableCell className={muted ? 'opacity-60' : undefined}>
        <div className="flex items-baseline gap-3 text-xs tabular-nums">
          <Metric value={number.format(m.clicks)} label="clicks" />
          <Metric value={number.format(m.conversions)} label="conv" />
          <Metric value={money.format(m.revenue)} label="rev" />
        </div>
      </TableCell>
      <TableCell className={muted ? 'opacity-60' : undefined}>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
            <Sparkline values={m.daily_clicks} />
          </TooltipTrigger>
          <TooltipContent>
            <div className="grid grid-cols-[auto_auto] gap-x-3 text-xs tabular-nums">
              {state.days.map((day, i) => (
                <div key={day} className="contents">
                  <span className="opacity-70">{day.slice(5)}</span>
                  <span className="text-right">{m.daily_clicks[i] ?? 0} clicks</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TableCell>
    </>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="font-medium text-foreground">{value}</span>{' '}
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}
