import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DeleteTemplateDialogProps = {
  id: number;
  teamId?: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DeleteTemplateDialog = ({
  id,
  teamId,
  open,
  onOpenChange,
}: DeleteTemplateDialogProps) => {
  const router = useRouter();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: deleteTemplate, isLoading } = trpcReact.template.deleteTemplate.useMutation({
    onSuccess: () => {
      router.refresh();

      toast({
        title: _(msg`Template deleted`),
        description: _(msg`Your template has been successfully deleted.`),
        duration: 5000,
      });

      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This template could not be deleted at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Do you want to delete this template?</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Please note that this action is irreversible. Once confirmed, your template will be
              permanently deleted.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            variant="destructive"
            loading={isLoading}
            onClick={async () => deleteTemplate({ id, teamId })}
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
