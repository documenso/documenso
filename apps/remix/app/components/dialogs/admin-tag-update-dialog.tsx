import { trpc } from '@documenso/trpc/react';
import type { TAdminTagData } from '@documenso/trpc/server/admin-router/tags/create-admin-tag.types';
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

import { AdminTagForm } from '../forms/admin-tag-form';

export type AdminTagUpdateDialogProps = {
  tag: Pick<TGetAdminTagsResponse[number], 'id' | 'type' | 'description'>;
  trigger: React.ReactNode;
};

export const AdminTagUpdateDialog = ({ tag, trigger }: AdminTagUpdateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [open, setOpen] = useState(false);

  const { mutateAsync: updateTag, isPending } = trpc.admin.tag.update.useMutation();

  const onFormSubmit = async (data: TAdminTagData) => {
    try {
      await updateTag({
        tagId: tag.id,
        data,
      });

      await trpcUtils.admin.tag.getMany.invalidate();

      toast({
        title: t`Tag updated`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to update the tag. Please try again.`,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit tag</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Change the tag or update its description.</Trans>
          </DialogDescription>
        </DialogHeader>

        <AdminTagForm
          defaultValues={{
            type: tag.type,
            description: tag.description,
          }}
          onFormSubmit={onFormSubmit}
          formSubmitTrigger={
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Save changes</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
