import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { OrganisationMemberRole } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { trpc } from '@documenso/trpc/react';
import { Alert } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
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

export type OrganisationLeaveDialogProps = {
  organisationId: string;
  organisationName: string;
  organisationAvatarImageId?: string | null;
  role: OrganisationMemberRole;
  trigger?: React.ReactNode;
};

export const OrganisationLeaveDialog = ({
  trigger,
  organisationId,
  organisationName,
  organisationAvatarImageId,
  role,
}: OrganisationLeaveDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: leaveOrganisation, isPending: isLeavingOrganisation } =
    trpc.organisation.leave.useMutation({
      onSuccess: () => {
        toast({
          title: t`Success`,
          description: t`You have successfully left this organisation.`,
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: t`An unknown error occurred`,
          description: t`We encountered an unknown error while attempting to leave this organisation. Please try again later.`,
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLeavingOrganisation && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive">
            <Trans>Leave organisation</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>You are about to leave the following organisation.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarSrc={formatAvatarUrl(organisationAvatarImageId)}
            avatarFallback={organisationName.slice(0, 1).toUpperCase()}
            primaryText={organisationName}
            secondaryText={t(ORGANISATION_MEMBER_ROLE_MAP[role])}
          />
        </Alert>

        <fieldset disabled={isLeavingOrganisation}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isLeavingOrganisation}
              onClick={async () => leaveOrganisation({ organisationId })}
            >
              <Trans>Leave</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
