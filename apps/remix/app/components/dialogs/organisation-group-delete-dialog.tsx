import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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

export type OrganisationGroupDeleteDialogProps = {
  organisationGroupId: string;
  organisationGroupName: string;
  trigger?: React.ReactNode;
};

export const OrganisationGroupDeleteDialog = ({
  trigger,
  organisationGroupId,
  organisationGroupName,
}: OrganisationGroupDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const { mutateAsync: deleteGroup, isPending: isDeleting } =
    trpc.organisation.group.delete.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`You have successfully removed this group from the organisation.`),
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: _(msg`An unknown error occurred`),
          description: _(
            msg`We encountered an unknown error while attempting to remove this group. Please try again later.`,
          ),
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Delete organisation group</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to remove the following group from{' '}
              <span className="font-semibold">{organisation.name}</span>.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="text-center font-semibold">
            {organisationGroupName}
          </AlertDescription>
        </Alert>

        <fieldset disabled={isDeleting}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isDeleting}
              onClick={async () =>
                deleteGroup({
                  organisationId: organisation.id,
                  groupId: organisationGroupId,
                })
              }
            >
              <Trans>Delete</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
