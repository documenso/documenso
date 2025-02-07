import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

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

type TemplateDuplicateDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const TemplateDuplicateDialog = ({
  id,
  open,
  onOpenChange,
}: TemplateDuplicateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: duplicateTemplate, isPending } =
    trpcReact.template.duplicateTemplate.useMutation({
      onSuccess: () => {
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
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
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
            disabled={isPending}
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isPending}
            onClick={async () =>
              duplicateTemplate({
                templateId: id,
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
