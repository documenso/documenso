import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TeamMemberRole } from '@prisma/client';

import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
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

export type TeamLeaveDialogProps = {
  teamId: number;
  teamName: string;
  teamAvatarImageId?: string | null;
  role: TeamMemberRole;
  trigger?: React.ReactNode;
};

export const TeamLeaveDialog = ({
  trigger,
  teamId,
  teamName,
  teamAvatarImageId,
  role,
}: TeamLeaveDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: leaveTeam, isPending: isLeavingTeam } = trpc.team.leaveTeam.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`You have successfully left this team.`),
        duration: 5000,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to leave this team. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLeavingTeam && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive">
            <Trans>Leave team</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>You are about to leave the following team.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarSrc={formatAvatarUrl(teamAvatarImageId)}
            avatarFallback={teamName.slice(0, 1).toUpperCase()}
            primaryText={teamName}
            secondaryText={_(TEAM_MEMBER_ROLE_MAP[role])}
          />
        </Alert>

        <fieldset disabled={isLeavingTeam}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isLeavingTeam}
              onClick={async () => leaveTeam({ teamId })}
            >
              <Trans>Leave</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
