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
  showTypeField?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AdminTagUpdateDialog = ({
  tag,
  showTypeField = true,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AdminTagUpdateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const { mutateAsync: updateTag, isPending } = trpc.admin.tag.update.useMutation();

  const onFormSubmit = async (data: TAdminTagData) => {
    try {
      await updateTag({
        tagId: tag.id,
        data: {
          type: data.type,
          description: data.description,
        },
      });

      await trpcUtils.admin.tag.invalidate();

      toast({
        title: t`Success`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`Something went wrong`,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit tag</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Update the tag's details.</Trans>
          </DialogDescription>
        </DialogHeader>

        <AdminTagForm
          defaultValues={{
            type: tag.type,
            description: tag.description,
          }}
          showTypeField={showTypeField}
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
