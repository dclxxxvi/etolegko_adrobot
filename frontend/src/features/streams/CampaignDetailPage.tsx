import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/ErrorState'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError, getErrorMessage } from '@/lib/api'
import { countryFlag, countryName } from '@/lib/countries'
import { useCampaign, useMeta, useStats, useStreams, useSyncStreams } from '@/lib/queries'
import type { Campaign } from '@/lib/types'
import { OfferStreamRows } from './OfferStreamRows'
import { RedirectStreamRows } from './RedirectStreamRows'
import type { StatsState } from './StatsCells'

export function CampaignDetailPage() {
  const id = Number(useParams().id)
  const campaign = useCampaign(id)

  if (campaign.isError) {
    const notFound = campaign.error instanceof ApiError && campaign.error.status === 404
    return (
      <div className="rounded-xl border bg-card">
        <ErrorState
          title={notFound ? 'Campaign not found' : 'Failed to load campaign'}
          error={notFound ? new Error('It may have been deleted.') : campaign.error}
          onRetry={notFound ? undefined : () => void campaign.refetch()}
          retrying={campaign.isFetching}
          action={
            <Button variant="outline" size="sm" render={<Link to="/campaigns" />}>
              <ArrowLeftIcon />
              Back to campaigns
            </Button>
          }
        />
      </div>
    )
  }

  return <CampaignDetail id={id} campaign={campaign.data} />
}

function CampaignDetail({ id, campaign }: { id: number; campaign: Campaign | undefined }) {
  const streams = useStreams(id)
  const stats = useStats(id)
  const meta = useMeta()
  const sync = useSyncStreams(id)

  const [dirtyStreams, setDirtyStreams] = useState<ReadonlySet<number>>(new Set())
  const hasChanges = dirtyStreams.size > 0
  const [confirmFetch, setConfirmFetch] = useState(false)

  const onDirtyChange = useCallback((streamId: number, dirty: boolean) => {
    setDirtyStreams((prev) => {
      if (prev.has(streamId) === dirty) return prev
      const next = new Set(prev)
      if (dirty) next.add(streamId)
      else next.delete(streamId)
      return next
    })
  }, [])

  // warn before leaving with unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  const fetchFromKt = async () => {
    setConfirmFetch(false)
    try {
      await sync.mutateAsync()
      toast.success('Streams fetched from Keitaro')
    } catch (error) {
      toast.error('Failed to fetch streams', { description: getErrorMessage(error) })
    }
  }

  // the flow with offers goes first, redirect flows after it
  const ordered = useMemo(
    () =>
      [...(streams.data ?? [])].sort(
        (a, b) =>
          Number(b.schema_type === 'landings') - Number(a.schema_type === 'landings') ||
          a.position - b.position,
      ),
    [streams.data],
  )

  const statsState: StatsState = {
    loading: stats.isPending,
    error: stats.isError,
    days: stats.data?.days ?? [],
  }
  const ktUrl =
    meta.data && campaign
      ? `${meta.data.keitaro_url}/#!/campaigns/${campaign.kt_campaign_id}`
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          {campaign ? (
            <>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{campaign.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {countryFlag(campaign.country_code)} {countryName(campaign.country_code)}
                </span>
                <span>
                  Offer <span className="text-foreground">#{campaign.offer_id}</span>
                </span>
                <span>
                  KT <span className="text-foreground">#{campaign.kt_campaign_id}</span> ·{' '}
                  {campaign.kt_alias}
                </span>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-80" />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => (hasChanges ? setConfirmFetch(true) : void fetchFromKt())}
            disabled={sync.isPending || !campaign}
          >
            {sync.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            Fetch streams from KT
          </Button>
          <a
            href={ktUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!ktUrl}
            className={buttonVariants({
              variant: 'outline',
              className: !ktUrl && 'pointer-events-none opacity-50',
            })}
          >
            <ExternalLinkIcon />
            View in KT
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {streams.isError ? (
          <ErrorState
            title="Failed to load streams"
            error={streams.error}
            onRetry={() => void streams.refetch()}
            retrying={streams.isFetching}
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="w-36">Share</TableHead>
                <TableHead className="w-60">Stats · 7d</TableHead>
                <TableHead className="w-32">Trends</TableHead>
                <TableHead className="w-36 pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.isPending ? (
                <StreamsSkeleton />
              ) : ordered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No streams. Try fetching them from Keitaro.
                  </TableCell>
                </TableRow>
              ) : (
                ordered.map((stream) =>
                  stream.schema_type === 'landings' ? (
                    <OfferStreamRows
                      key={stream.id}
                      campaignId={id}
                      stream={stream}
                      stats={stats.data?.streams[stream.kt_stream_id]}
                      statsState={statsState}
                      onDirtyChange={onDirtyChange}
                    />
                  ) : (
                    <RedirectStreamRows
                      key={stream.id}
                      stream={stream}
                      stats={stats.data?.streams[stream.kt_stream_id]}
                      statsState={statsState}
                    />
                  ),
                )
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={confirmFetch}
        title="Discard unsaved changes?"
        description="Fetching streams from Keitaro will reset changes that were not pushed."
        confirmLabel="Discard and fetch"
        onConfirm={() => void fetchFromKt()}
        onCancel={() => setConfirmFetch(false)}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without pushing?"
        description="You have changes that were not pushed to Keitaro. They will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function StreamsSkeleton() {
  return (
    <>
      {[3, 1].map((rows, s) => (
        <StreamSkeleton key={s} rows={rows} />
      ))}
    </>
  )
}

function StreamSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={5} className="h-12 px-4">
          <Skeleton className="h-4 w-56" />
        </TableCell>
      </TableRow>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} className="h-12 hover:bg-transparent">
          <TableCell className="pl-8">
            <Skeleton className="h-4 w-3/4" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-7 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24" />
          </TableCell>
          <TableCell className="pr-4">
            <Skeleton className="ml-auto h-7 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
