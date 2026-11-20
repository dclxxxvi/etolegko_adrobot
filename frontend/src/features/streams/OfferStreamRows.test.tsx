import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Table, TableBody } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Stream } from '@/lib/types'
import { OfferStreamRows } from './OfferStreamRows'

const stream: Stream = {
  id: 2,
  kt_stream_id: 11,
  name: 'Offers',
  position: 2,
  schema_type: 'landings',
  action_payload: null,
  countries: [],
  offers: [
    { offer_id: 1, offer_name: 'Offer One', share: 50, pinned: false, is_active: true },
    { offer_id: 2, offer_name: 'Offer Two', share: 50, pinned: false, is_active: true },
    { offer_id: 3, offer_name: 'Offer Three', share: 0, pinned: false, is_active: false },
  ],
}

function mockFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/offers') return Response.json([{ id: 1, name: 'Offer One' }])
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { offers: Stream['offers'] }
      return Response.json({ ...stream, offers: body.offers })
    }
    return Response.json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderRows() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <Table>
          <TableBody>
            <OfferStreamRows
              campaignId={7}
              stream={stream}
              stats={undefined}
              statsState={{ loading: false, error: false, days: [] }}
              onDirtyChange={() => {}}
            />
          </TableBody>
        </Table>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const row = (name: string) => screen.getByText(name).closest('tr')!
const share = (id: number) => screen.getByLabelText(`Share of offer #${id}`)

describe('OfferStreamRows', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the stream header and offers', () => {
    mockFetch()
    renderRows()
    expect(screen.getByText('Flow 2: Offers')).toBeInTheDocument()
    expect(share(1)).toHaveValue('50')
    expect(within(row('Offer Three')).getByRole('button', { name: /bring back/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /push to kt/i })).not.toBeInTheDocument()
  })

  it('remove -> recalculates, highlights, pushes to Keitaro', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderRows()

    await user.click(within(row('Offer One')).getByRole('button', { name: /remove/i }))

    expect(share(1)).toHaveValue('0')
    expect(share(2)).toHaveValue('100')
    expect(row('Offer One')).toHaveAttribute('data-change', 'removed')
    expect(within(row('Offer One')).getByRole('button', { name: /bring back/i })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /push to kt/i }))

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(put[0]).toBe('/api/campaigns/7/streams/2/offers')
    expect(JSON.parse(String(put[1]!.body)).offers).toEqual([
      { offer_id: 1, share: 0, pinned: false, is_active: false },
      { offer_id: 2, share: 100, pinned: false, is_active: true },
      { offer_id: 3, share: 0, pinned: false, is_active: false },
    ])
  })

  it('bring back + cancel restores the saved state', async () => {
    mockFetch()
    const user = userEvent.setup()
    renderRows()

    await user.click(within(row('Offer Three')).getByRole('button', { name: /bring back/i }))
    expect([share(1), share(2), share(3)].map((el) => el.getAttribute('value'))).toEqual([
      '34',
      '33',
      '33',
    ])

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(share(3)).toHaveValue('0')
    expect(screen.queryByRole('button', { name: /push to kt/i })).not.toBeInTheDocument()
  })

  it('manual share pins the offer and blocks invalid totals', async () => {
    mockFetch()
    const user = userEvent.setup()
    renderRows()

    await user.click(within(row('Offer One')).getByRole('button', { name: /pin share/i }))
    await user.click(within(row('Offer Two')).getByRole('button', { name: /pin share/i }))
    await user.clear(share(1))
    await user.type(share(1), '30{Enter}')

    expect(screen.getByText(/shares must sum to 100%/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /push to kt/i })).toBeDisabled()
  })
})
