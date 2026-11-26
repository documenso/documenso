import { trpc } from '@documenso/trpc/react';
import type { TAdminTagData } from '@documenso/trpc/server/admin-router/tags/create-admin-tag.types';
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
  trigger?: React.ReactNode;
};

export const AdminTagCreateDialog = ({ subject, trigger }: AdminTagCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [open, setOpen] = useState(false);

  const { mutateAsync: createTag, isPending } = trpc.admin.tag.create.useMutation();

  const onFormSubmit = async (data: TAdminTagData) => {
    try {
      const payload =
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

      await trpcUtils.admin.tag.getMany.invalidate(subject);

      toast({
        title: t`Tag added`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to add the tag. Please try again.`,
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
              <Trans>Tag this organisation so other admins know to keep an eye on it.</Trans>
            ) : (
              <Trans>Tag this user so other admins know to keep an eye on them.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <AdminTagForm
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
