import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { countryFlag, countryName } from '@/lib/countries'
import { PAGE_SIZE, useCampaigns } from '@/lib/queries'
import type { Campaign } from '@/lib/types'
import { cn } from '@/lib/utils'
import { offerDisplayName } from '@/lib/offers'
import { CampaignFormDialog } from './CampaignFormDialog'
import { DeleteCampaignDialog } from './DeleteCampaignDialog'

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function CampaignsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)

  const [search, setSearch] = useState(q)
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  useEffect(() => {
    if (debouncedSearch === q) return
    setParams(debouncedSearch ? { q: debouncedSearch } : {}, { replace: true })
  }, [debouncedSearch, q, setParams])

  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useCampaigns(
    q,
    page,
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState<Campaign | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (campaign: Campaign) => {
    setEditing(campaign)
    setFormOpen(true)
  }
  const goToPage = (next: number) => {
    const nextParams: Record<string, string> = {}
    if (q) nextParams.q = q
    if (next > 0) nextParams.page = String(next)
    setParams(nextParams)
  }

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const searching = isFetching && (isPlaceholderData || search.trim() !== q)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Keitaro campaigns with a geo redirect flow and an offers flow.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon />
          New campaign
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="h-9 pr-9 pl-8"
          aria-label="Search campaigns by name"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
          {searching ? (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          ) : (
            search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon className="size-4" />
              </button>
            )
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isError ? (
          <ErrorState
            title="Failed to load campaigns"
            error={error}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[32%] pl-4">Name</TableHead>
                <TableHead className="w-[16%]">Country</TableHead>
                <TableHead className="w-[26%]">Offer</TableHead>
                <TableHead className="w-[14%]">Updated</TableHead>
                <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              className={cn('transition-opacity', isPlaceholderData && isFetching && 'opacity-60')}
            >
              {isPending ? (
                Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
              ) : data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                    {q ? (
                      <>Nothing found for “{q}”</>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <span>No campaigns yet</span>
                        <Button variant="outline" size="sm" onClick={openCreate}>
                          <PlusIcon />
                          Create the first one
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="h-12 cursor-pointer"
                    onClick={() => void navigate(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell className="truncate pl-4 font-medium">
                      {campaign.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        KT #{campaign.kt_campaign_id}
                      </span>
                    </TableCell>
                    <TableCell className="truncate">
                      <span className="mr-1.5">{countryFlag(campaign.country_code)}</span>
                      {countryName(campaign.country_code)}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      <span className="text-foreground">#{campaign.offer_id}</span>{' '}
                      {campaign.offer_name &&
                        offerDisplayName(campaign.offer_id, campaign.offer_name)}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {dateFormat.format(new Date(campaign.updated_at))}
                    </TableCell>
                    <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowAction label="Edit" onClick={() => openEdit(campaign)}>
                        <PencilIcon />
                      </RowAction>
                      <RowAction label="Delete" onClick={() => setDeleting(campaign)} destructive>
                        <Trash2Icon />
                      </RowAction>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(page + 1)}
              disabled={page + 1 >= pages}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}

      <CampaignFormDialog open={formOpen} onOpenChange={setFormOpen} campaign={editing} />
      <DeleteCampaignDialog campaign={deleting} onOpenChange={() => setDeleting(null)} />
    </div>
  )
}

function SkeletonRow() {
  return (
    <TableRow className="h-12 hover:bg-transparent">
      <TableCell className="pl-4">
        <Skeleton className="h-4 w-3/4" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-2/3" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="pr-4">
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
    </TableRow>
  )
}

function RowAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            className={cn(destructive && 'hover:bg-destructive/10 hover:text-destructive')}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
