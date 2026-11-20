import { ArrowLeftIcon } from 'lucide-react'
import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { CampaignDetailPage } from '@/features/streams/CampaignDetailPage'

function Layout() {
  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">This page does not exist.</p>
      <Button variant="outline" render={<Link to="/campaigns" />}>
        <ArrowLeftIcon />
        Back to campaigns
      </Button>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/campaigns" replace /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
