import { RadarIcon } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useMatch } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { useCampaign } from '@/lib/queries'

interface Crumb {
  label: React.ReactNode
  to?: string
}

function CampaignName({ id }: { id: number }) {
  const { data, isPending, isError } = useCampaign(id)
  if (isPending) return <Skeleton className="h-4 w-32" />
  if (isError) return <>Campaign #{id}</>
  return <span className="block max-w-64 truncate">{data.name}</span>
}

export function AppHeader() {
  const detail = useMatch('/campaigns/:id')
  const campaignId = detail ? Number(detail.params.id) : null

  const crumbs: Crumb[] = [
    { label: 'Campaigns', to: campaignId !== null ? '/campaigns' : undefined },
  ]
  if (campaignId !== null && Number.isFinite(campaignId)) {
    crumbs.push({ label: <CampaignName id={campaignId} /> }, { label: 'Keitaro Streams' })
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        <Link to="/campaigns" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <RadarIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">KT Wrapper</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              <Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.to ? (
                    <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                  ) : i === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
