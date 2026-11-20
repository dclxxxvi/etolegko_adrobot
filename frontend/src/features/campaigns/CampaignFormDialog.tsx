import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Combobox } from '@/components/Combobox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/api'
import { COUNTRIES, countryFlag } from '@/lib/countries'
import { useOffers, useSaveCampaign } from '@/lib/queries'
import type { Campaign } from '@/lib/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Max 255 characters'),
  country_code: z.string({ error: 'Select a country' }).length(2, 'Select a country'),
  offer_id: z.number({ error: 'Select an offer' }).int().positive('Select an offer'),
})

type FormValues = z.infer<typeof schema>

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
  prefix: countryFlag(c.code),
  keywords: [c.code],
}))

interface CampaignFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Campaign to edit; create mode when omitted */
  campaign?: Campaign | null
}

export function CampaignFormDialog({ open, onOpenChange, campaign }: CampaignFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* re-mount the form on open to reset it */}
        {open && <CampaignForm campaign={campaign} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CampaignForm({ campaign, onDone }: { campaign?: Campaign | null; onDone: () => void }) {
  const isEdit = Boolean(campaign)
  const navigate = useNavigate()
  const offers = useOffers()
  const save = useSaveCampaign()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: campaign
      ? { name: campaign.name, country_code: campaign.country_code, offer_id: campaign.offer_id }
      : { name: '' },
  })
  const { errors } = form.formState

  const offerOptions = useMemo(() => {
    const options = (offers.data ?? []).map((o) => ({
      value: String(o.id),
      label: o.name,
      keywords: [String(o.id)],
    }))
    // keep the current offer selectable even if Keitaro does not list it anymore
    if (campaign && !options.some((o) => o.value === String(campaign.offer_id))) {
      options.unshift({
        value: String(campaign.offer_id),
        label: campaign.offer_name ?? `Offer #${campaign.offer_id}`,
        keywords: [],
      })
    }
    return options
  }, [offers.data, campaign])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: campaign?.id, data: values })
      toast.success(isEdit ? 'Campaign updated' : 'Campaign created in Keitaro')
      onDone()
      if (!isEdit) void navigate(`/campaigns/${saved.id}`)
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error) })
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit campaign' : 'New campaign'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Changes are applied to the campaign and its streams in Keitaro.'
            : 'Creates a campaign in Keitaro with a geo redirect flow and an offers flow.'}
        </DialogDescription>
      </DialogHeader>

      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoFocus
          autoComplete="off"
          placeholder="e.g. Flexacil PE — FB"
          aria-invalid={Boolean(errors.name) || undefined}
          {...form.register('name')}
        />
      </Field>

      <Field label="Country" htmlFor="country" error={errors.country_code?.message}>
        <Controller
          control={form.control}
          name="country_code"
          render={({ field }) => (
            <Combobox
              id="country"
              value={field.value ?? null}
              onChange={field.onChange}
              options={COUNTRY_OPTIONS}
              placeholder="Select country"
              searchPlaceholder="Search country or code…"
              invalid={Boolean(errors.country_code)}
            />
          )}
        />
      </Field>

      <Field
        label="Offer"
        htmlFor="offer"
        error={
          errors.offer_id?.message ??
          (offers.isError ? `Failed to load offers: ${getErrorMessage(offers.error)}` : undefined)
        }
      >
        <Controller
          control={form.control}
          name="offer_id"
          render={({ field }) => (
            <Combobox
              id="offer"
              value={field.value ? String(field.value) : null}
              onChange={(value) => field.onChange(Number(value))}
              options={offerOptions}
              placeholder="Select offer"
              searchPlaceholder="Search offer or ID…"
              loading={offers.isPending}
              invalid={Boolean(errors.offer_id)}
            />
          )}
        />
      </Field>

      {errors.root && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending} className="min-w-24">
          {save.isPending && <Loader2Icon className="animate-spin" />}
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <p className="min-h-4 text-xs text-destructive">{error}</p>
    </div>
  )
}
