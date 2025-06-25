import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
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

export type OrganisationEmailDomainDeleteDialogProps = {
  emailDomainId: string;
  emailDomain: string;
  trigger?: React.ReactNode;
};

export const OrganisationEmailDomainDeleteDialog = ({
  trigger,
  emailDomainId,
  emailDomain,
}: OrganisationEmailDomainDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const { mutateAsync: deleteEmailDomain, isPending: isDeleting } =
    trpc.organisation.emailDomain.delete.useMutation({
      onSuccess: () => {
        toast({
          title: t`Success`,
          description: t`You have successfully removed this email domain from the organisation.`,
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: t`An unknown error occurred`,
          description: t`We encountered an unknown error while attempting to remove this email domain. Please try again later.`,
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
            <Trans>Delete email domain</Trans>
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
              You are about to remove the following email domain from{' '}
              <span className="font-semibold">{organisation.name}</span>.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="text-center font-semibold">{emailDomain}</AlertDescription>
        </Alert>

        {/* Todo: Make them type the email in */}

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
                deleteEmailDomain({
                  organisationId: organisation.id,
                  emailDomainId,
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
