import type { TAdminTagType } from '@documenso/lib/types/admin-tags';
import { trpc } from '@documenso/trpc/react';
import type {
  TAdminTagData,
  TCreateAdminTagRequest,
} from '@documenso/trpc/server/admin-router/tags/create-admin-tag.types';
import type { TGetAdminTagsRequest } from '@documenso/trpc/server/admin-router/tags/get-admin-tags.types';
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
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { AdminTagForm } from '../forms/admin-tag-form';

export type AdminTagCreateDialogProps = {
  subject: TGetAdminTagsRequest;
  defaultType: TAdminTagType;
  showTypeField?: boolean;
  trigger?: React.ReactNode;
};

export const AdminTagCreateDialog = ({
  subject,
  defaultType,
  showTypeField = true,
  trigger,
}: AdminTagCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [open, setOpen] = useState(false);

  const { mutateAsync: createTag, isPending } = trpc.admin.tag.create.useMutation();

  const onFormSubmit = async (data: TAdminTagData) => {
    try {
      const payload: TCreateAdminTagRequest =
        subject.type === 'user'
          ? {
              userId: subject.userId,
              type: data.type,
              description: data.description,
            }
          : {
              organisationId: subject.organisationId,
              type: data.type,
              description: data.description,
            };

      await createTag(payload);

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
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="shrink-0">
            <PlusIcon className="mr-1.5 h-4 w-4" />
            <Trans>Add tag</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add tag</Trans>
          </DialogTitle>

          <DialogDescription>
            {subject.type === 'organisation' ? (
              <Trans>Add a tag to this organisation.</Trans>
            ) : (
              <Trans>Add a tag to this user.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <AdminTagForm
          defaultValues={{
            type: defaultType,
            description: '',
          }}
          showTypeField={showTypeField}
          onFormSubmit={onFormSubmit}
          formSubmitTrigger={
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Add tag</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
