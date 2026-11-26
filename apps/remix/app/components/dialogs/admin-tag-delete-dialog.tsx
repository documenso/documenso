import { ADMIN_TAG_TYPE_MAP } from '@documenso/lib/constants/admin-tags-translations';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminTagsResponse } from '@documenso/trpc/server/admin-router/tags/get-admin-tags.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
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

export type AdminTagDeleteDialogProps = {
  tag: Pick<TGetAdminTagsResponse[number], 'id' | 'type' | 'description' | 'adminRule'>;
  trigger?: React.ReactNode;
};

export const AdminTagDeleteDialog = ({ tag, trigger }: AdminTagDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [open, setOpen] = useState(false);

  const { mutate: deleteTag, isPending: isDeleting } = trpc.admin.tag.delete.useMutation({
    onSuccess: async () => {
      await trpcUtils.admin.tag.getMany.invalidate();

      toast({
        title: t`Tag removed`,
        duration: 5000,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to remove the tag. Please try again.`,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Trans>Remove</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            {tag.adminRule ? (
              <Trans>
                You are about to remove the following tag from this user. The rule that added it can tag them again the
                next time it matches.
              </Trans>
            ) : (
              <Trans>You are about to remove the following tag from this user. This can't be undone.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="flex flex-col items-start gap-2">
            <Badge variant="warning" size="small">
              {t(ADMIN_TAG_TYPE_MAP[tag.type])}
            </Badge>

            <span className="text-foreground [overflow-wrap:anywhere]">{tag.description}</span>
          </AlertDescription>
        </Alert>

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
