import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { useDeleteCampaign } from '@/lib/queries'
import type { Campaign } from '@/lib/types'

interface DeleteCampaignDialogProps {
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteCampaignDialog({
  campaign,
  onOpenChange,
  onDeleted,
}: DeleteCampaignDialogProps) {
  const remove = useDeleteCampaign()
  // keep the last campaign so the text does not disappear during the close animation
  const [shown, setShown] = useState(campaign)
  if (campaign && campaign !== shown) setShown(campaign)

  const confirm = async () => {
    if (!campaign) return
    try {
      await remove.mutateAsync(campaign.id)
      toast.success(`Campaign “${campaign.name}” deleted`)
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      toast.error('Failed to delete campaign', { description: getErrorMessage(error) })
    }
  }

  return (
    <AlertDialog
      open={campaign !== null}
      onOpenChange={(open) => !remove.isPending && onOpenChange(open)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            “{shown?.name}” will be deleted here and moved to the archive in Keitaro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending && <Loader2Icon className="animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
