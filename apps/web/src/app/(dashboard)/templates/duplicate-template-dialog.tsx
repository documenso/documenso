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

type DuplicateTemplateDialogProps = {
  id: number;
  teamId?: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DuplicateTemplateDialog = ({
  id,
  teamId,
  open,
  onOpenChange,
}: DuplicateTemplateDialogProps) => {
  const router = useRouter();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: duplicateTemplate, isLoading } =
    trpcReact.template.duplicateTemplate.useMutation({
      onSuccess: () => {
        router.refresh();

        toast({
          title: _(msg`Template duplicated`),
          description: _(msg`Your template has been duplicated successfully.`),
          duration: 5000,
        });

        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while duplicating template.`),
          variant: 'destructive',
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Do you want to duplicate this template?</Trans>
          </DialogTitle>

          <DialogDescription className="pt-2">
            <Trans>Your template will be duplicated.</Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            disabled={isLoading}
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isLoading}
            onClick={async () =>
              duplicateTemplate({
                templateId: id,
                teamId,
              })
            }
          >
            <Trans>Duplicate</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
