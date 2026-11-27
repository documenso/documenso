import { trpc } from '@documenso/trpc/react';
import type { TGetAdminTagsResponse } from '@documenso/trpc/server/admin-router/tags/get-admin-tags.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { AdminTagTypeBadge } from '~/components/general/admin-tag-type-badge';

export type AdminTagDeleteDialogProps = {
  tag: Pick<TGetAdminTagsResponse[number], 'id' | 'type' | 'description' | 'organisationId' | 'adminRule'>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AdminTagDeleteDialog = ({
  tag,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AdminTagDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const { mutate: deleteTag, isPending: isDeleting } = trpc.admin.tag.delete.useMutation({
    onSuccess: async () => {
      await trpcUtils.admin.tag.invalidate();

      toast({
        title: t`Success`,
        duration: 5000,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            {tag.organisationId ? (
              <Trans>You are about to remove the following tag from this organisation.</Trans>
            ) : (
              <Trans>You are about to remove the following tag from this user.</Trans>
            )}{' '}
            {tag.adminRule ? (
              <Trans>The rule that added it can add it again the next time it matches.</Trans>
            ) : (
              <Trans>This can't be undone.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-start gap-2 rounded-lg border p-4 text-sm">
          <AdminTagTypeBadge type={tag.type} />

          <span className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{tag.description}</span>
        </div>

        <fieldset disabled={isDeleting}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              variant="destructive"
              loading={isDeleting}
              onClick={() => deleteTag({ tagId: tag.id })}
            >
              <Trans>Remove tag</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
