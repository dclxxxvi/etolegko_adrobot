import { ArrowRightIcon, GlobeIcon } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import { countryFlag } from '@/lib/countries'
import type { Stream, StreamStats } from '@/lib/types'
import { StatsCells, type StatsState } from './StatsCells'
import { StreamHeaderRow } from './StreamHeaderRow'

interface RedirectStreamRowsProps {
  stream: Stream
  stats: StreamStats | undefined
  statsState: StatsState
}

/** A flow without offers (e.g. geo -> Google redirect). */
export function RedirectStreamRows({ stream, stats, statsState }: RedirectStreamRowsProps) {
  const target = stream.action_payload
  return (
    <>
      <StreamHeaderRow stream={stream} />
      <TableRow className="h-12 hover:bg-transparent">
        <TableCell className="pl-8">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {stream.countries.length > 0 ? (
                <>
                  Country{' '}
                  {stream.countries.map((c) => (
                    <span key={c} className="mr-1 font-medium">
                      {countryFlag(c)} {c}
                    </span>
                  ))}
                </>
              ) : (
                'All traffic'
              )}
            </span>
            <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{target ?? stream.schema_type}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">No offers</TableCell>
        <StatsCells metrics={stats?.total} state={statsState} />
        <TableCell />
      </TableRow>
    </>
  )
}
