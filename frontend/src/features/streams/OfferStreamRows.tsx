import { Loader2Icon, PinIcon, PlusIcon, Undo2Icon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/Combobox'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getErrorMessage } from '@/lib/api'
import { usePushOffers, useOffers } from '@/lib/queries'
import { validateShares } from '@/lib/shares'
import { draftReducer, initDraft, isDirty, offerChange, type OfferChange } from '@/lib/streamDraft'
import type { Stream, StreamOffer, StreamStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { offerDisplayName } from '@/lib/offers'
import { ShareInput } from './ShareInput'
import { StatsCells, type StatsState } from './StatsCells'
import { StreamHeaderRow } from './StreamHeaderRow'

const CHANGE_LABEL: Record<Exclude<OfferChange, null>, string> = {
  added: 'new',
  restored: 'restored',
  removed: 'removed',
  changed: 'changed',
}

interface OfferStreamRowsProps {
  campaignId: number
  stream: Stream
  stats: StreamStats | undefined
  statsState: StatsState
  onDirtyChange: (streamId: number, dirty: boolean) => void
}

export function OfferStreamRows({
  campaignId,
  stream,
  stats,
  statsState,
  onDirtyChange,
}: OfferStreamRowsProps) {
  const [draft, dispatch] = useReducer(draftReducer, stream.offers, initDraft)
  // the saved state changed (push / fetch) -> reset the draft
  const [savedOffers, setSavedOffers] = useState(stream.offers)
  if (stream.offers !== savedOffers) {
    setSavedOffers(stream.offers)
    dispatch({ type: 'reset', base: stream.offers })
  }

  const dirty = isDirty(draft)
  const validation = validateShares(draft.offers)
  const push = usePushOffers(campaignId)
  const busy = push.isPending

  useEffect(() => {
    onDirtyChange(stream.id, dirty)
  }, [dirty, stream.id, onDirtyChange])
  useEffect(() => () => onDirtyChange(stream.id, false), [stream.id, onDirtyChange])

  const pushToKt = async () => {
    try {
      await push.mutateAsync({ streamId: stream.id, offers: draft.offers })
      toast.success(`Flow ${stream.position} pushed to Keitaro`)
    } catch (error) {
      toast.error('Failed to push changes', { description: getErrorMessage(error) })
    }
  }

  return (
    <>
      <StreamHeaderRow stream={stream}>
        {dirty && (
          <div className="flex animate-in items-center gap-3 fade-in-0">
            {(validation.error ?? validation.warning) && (
              <span
                className={cn('text-xs', validation.error ? 'text-destructive' : 'text-amber-700')}
              >
                {validation.error ?? validation.warning}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatch({ type: 'cancel' })}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={pushToKt} disabled={busy || validation.error !== null}>
              {busy && <Loader2Icon className="animate-spin" />}
              Push to KT
            </Button>
          </div>
        )}
      </StreamHeaderRow>

      {draft.offers.length === 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="h-12 pl-8 text-muted-foreground">
            No offers in this flow yet
          </TableCell>
        </TableRow>
      )}

      {draft.offers.map((offer) => (
        <OfferRow
          key={offer.offer_id}
          offer={offer}
          change={offerChange(offer, draft.base)}
          stats={stats?.offers[offer.offer_id]}
          statsState={statsState}
          disabled={busy}
          onRemove={() => dispatch({ type: 'remove', offerId: offer.offer_id })}
          onBringBack={() => dispatch({ type: 'bringBack', offerId: offer.offer_id })}
          onTogglePin={() => dispatch({ type: 'togglePin', offerId: offer.offer_id })}
          onShare={(share) => dispatch({ type: 'setShare', offerId: offer.offer_id, share })}
        />
      ))}

      <AddOfferRow
        present={draft.offers}
        disabled={busy}
        onAdd={(offerId, name) => dispatch({ type: 'add', offerId, name })}
      />
    </>
  )
}

interface OfferRowProps {
  offer: StreamOffer
  change: OfferChange
  stats: StreamStats['total'] | undefined
  statsState: StatsState
  disabled: boolean
  onRemove: () => void
  onBringBack: () => void
  onTogglePin: () => void
  onShare: (share: number) => void
}

function OfferRow({
  offer,
  change,
  stats,
  statsState,
  disabled,
  onRemove,
  onBringBack,
  onTogglePin,
  onShare,
}: OfferRowProps) {
  const inactive = !offer.is_active
  return (
    <TableRow
      data-change={change ?? undefined}
      className={cn(
        'h-12 transition-colors',
        change && 'bg-amber-50 hover:bg-amber-100/70',
        inactive && 'text-muted-foreground',
      )}
    >
      <TableCell className="pl-8">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('shrink-0 tabular-nums', inactive ? '' : 'text-muted-foreground')}>
            #{offer.offer_id}
          </span>
          <span
            className={cn('truncate', inactive && 'line-through decoration-muted-foreground/40')}
          >
            {offerDisplayName(offer.offer_id, offer.offer_name)}
          </span>
          {change && (
            <span className="shrink-0 rounded-sm bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-900 uppercase">
              {CHANGE_LABEL[change]}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <ShareInput
            value={offer.share}
            onCommit={onShare}
            disabled={disabled || inactive}
            highlighted={offer.pinned}
            label={`Share of offer #${offer.offer_id}`}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={offer.pinned ? 'Unpin share' : 'Pin share'}
                  aria-pressed={offer.pinned}
                  disabled={disabled || inactive}
                  onClick={onTogglePin}
                  className={cn(
                    offer.pinned && 'bg-primary/10 text-primary hover:bg-primary/15',
                    inactive && 'invisible',
                  )}
                />
              }
            >
              <PinIcon className={offer.pinned ? 'fill-current' : undefined} />
            </TooltipTrigger>
            <TooltipContent>
              {offer.pinned ? 'Pinned: keeps its share. Click to unpin' : 'Pin this share'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
      <StatsCells metrics={stats} state={statsState} muted={inactive} />
      <TableCell className="pr-4 text-right">
        {inactive ? (
          <Button variant="outline" size="sm" onClick={onBringBack} disabled={disabled}>
            <Undo2Icon />
            Bring back
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <XIcon />
            Remove
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function AddOfferRow({
  present,
  disabled,
  onAdd,
}: {
  present: StreamOffer[]
  disabled: boolean
  onAdd: (offerId: number, name: string | null) => void
}) {
  const offers = useOffers()
  const [selected, setSelected] = useState<string | null>(null)

  const options = useMemo(() => {
    const presentIds = new Set(present.map((o) => o.offer_id))
    return (offers.data ?? [])
      .filter((o) => !presentIds.has(o.id))
      .map((o) => ({
        value: String(o.id),
        label: offerDisplayName(o.id, o.name),
        prefix: <span className="text-muted-foreground tabular-nums">#{o.id}</span>,
        keywords: [String(o.id)],
      }))
  }, [offers.data, present])

  const add = () => {
    if (!selected) return
    const offer = offers.data?.find((o) => String(o.id) === selected)
    onAdd(Number(selected), offer?.name ?? null)
    setSelected(null)
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={5} className="py-2.5 pl-8">
        <div className="flex items-center gap-2">
          <Combobox
            value={selected}
            onChange={setSelected}
            options={options}
            placeholder={
              offers.isError
                ? 'Failed to load offers'
                : options.length === 0 && !offers.isPending
                  ? 'All offers are already in the flow'
                  : 'Select offer to add…'
            }
            searchPlaceholder="Search offer or ID…"
            loading={offers.isPending}
            disabled={disabled || offers.isError || options.length === 0}
            className="h-8 max-w-md"
          />
          <Button variant="secondary" onClick={add} disabled={disabled || !selected}>
            <PlusIcon />
            Add
          </Button>
          {offers.isError && (
            <Button variant="link" size="sm" onClick={() => void offers.refetch()}>
              Retry
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
