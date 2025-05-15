import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { BellIcon } from 'lucide-react';

import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatTeamUrl } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const TeamInvitations = () => {
  const { data, isLoading } = trpc.team.getTeamInvitations.useQuery();

  return (
    <AnimatePresence>
      {data && data.length > 0 && !isLoading && (
        <AnimateGenericFadeInOut>
          <Alert variant="secondary">
            <div className="flex h-full flex-row items-center p-2">
              <BellIcon className="mr-4 h-5 w-5 text-blue-800" />

              <AlertDescription className="mr-2">
                <Plural
                  value={data.length}
                  one={
                    <span>
                      You have <strong>1</strong> pending team invitation
                    </span>
                  }
                  other={
                    <span>
                      You have <strong>#</strong> pending team invitations
                    </span>
                  }
                />
              </AlertDescription>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="ml-auto text-sm font-medium text-blue-700 hover:text-blue-600">
                    <Trans>View invites</Trans>
                  </button>
                </DialogTrigger>

                <DialogContent position="center">
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Pending invitations</Trans>
                    </DialogTitle>

                    <DialogDescription className="mt-4">
                      <Plural
                        value={data.length}
                        one={
                          <span>
                            You have <strong>1</strong> pending team invitation
                          </span>
                        }
                        other={
                          <span>
                            You have <strong>#</strong> pending team invitations
                          </span>
                        }
                      />
                    </DialogDescription>
                  </DialogHeader>

                  <ul className="-mx-6 -mb-6 max-h-[80vh] divide-y overflow-auto px-6 pb-6 xl:max-h-[70vh]">
                    {data.map((invitation) => (
                      <li key={invitation.teamId}>
                        <AvatarWithText
                          avatarSrc={formatAvatarUrl(invitation.team.avatarImageId)}
                          className="w-full max-w-none py-4"
                          avatarFallback={invitation.team.name.slice(0, 1)}
                          primaryText={
                            <span className="text-foreground/80 font-semibold">
                              {invitation.team.name}
                            </span>
                          }
                          secondaryText={formatTeamUrl(invitation.team.url)}
                          rightSideComponent={
                            <div className="ml-auto space-x-2">
                              <DeclineTeamInvitationButton teamId={invitation.team.id} />
                              <AcceptTeamInvitationButton teamId={invitation.team.id} />
                            </div>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </DialogContent>
              </Dialog>
            </div>
          </Alert>
        </AnimateGenericFadeInOut>
      )}
    </AnimatePresence>
  );
};

const AcceptTeamInvitationButton = ({ teamId }: { teamId: number }) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const {
    mutateAsync: acceptTeamInvitation,
    isPending,
    isSuccess,
  } = trpc.team.acceptTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Accepted team invitation`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to join this team at this time.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Button
      onClick={async () => acceptTeamInvitation({ teamId })}
      loading={isPending}
      disabled={isPending || isSuccess}
    >
      <Trans>Accept</Trans>
    </Button>
  );
};

const DeclineTeamInvitationButton = ({ teamId }: { teamId: number }) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const {
    mutateAsync: declineTeamInvitation,
    isPending,
    isSuccess,
  } = trpc.team.declineTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Declined team invitation`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to decline this team invitation at this time.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Button
      onClick={async () => declineTeamInvitation({ teamId })}
      loading={isPending}
      disabled={isPending || isSuccess}
      variant="ghost"
    >
      <Trans>Decline</Trans>
    </Button>
  );
};
