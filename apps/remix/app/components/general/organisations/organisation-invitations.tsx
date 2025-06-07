import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { AnimatePresence } from 'framer-motion';
import { BellIcon } from 'lucide-react';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
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

export const OrganisationInvitations = ({ className }: { className?: string }) => {
  const { data, isLoading } = trpc.organisation.member.invite.getMany.useQuery({
    status: OrganisationMemberInviteStatus.PENDING,
  });

  return (
    <AnimatePresence>
      {data && data.length > 0 && !isLoading && (
        <AnimateGenericFadeInOut>
          <Alert variant="secondary" className={className}>
            <div className="flex h-full flex-row items-center p-2">
              <BellIcon className="mr-4 h-5 w-5 text-blue-800" />

              <AlertDescription className="mr-2">
                <Plural
                  value={data.length}
                  one={
                    <span>
                      You have <strong>1</strong> pending invitation
                    </span>
                  }
                  other={
                    <span>
                      You have <strong>#</strong> pending invitations
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
                            You have <strong>1</strong> pending invitation
                          </span>
                        }
                        other={
                          <span>
                            You have <strong>#</strong> pending invitations
                          </span>
                        }
                      />
                    </DialogDescription>
                  </DialogHeader>

                  <ul className="-mx-6 -mb-6 max-h-[80vh] divide-y overflow-auto px-6 pb-6 xl:max-h-[70vh]">
                    {data.map((invitation) => (
                      <li key={invitation.id}>
                        <Alert variant="neutral" className="p-0 px-4">
                          <AvatarWithText
                            avatarSrc={formatAvatarUrl(invitation.organisation.avatarImageId)}
                            className="w-full max-w-none py-4"
                            avatarFallback={invitation.organisation.name.slice(0, 1)}
                            primaryText={
                              <span className="text-foreground/80 font-semibold">
                                {invitation.organisation.name}
                              </span>
                            }
                            secondaryText={`/orgs/${invitation.organisation.url}`}
                            rightSideComponent={
                              <div className="ml-auto space-x-2">
                                <DeclineOrganisationInvitationButton token={invitation.token} />
                                <AcceptOrganisationInvitationButton token={invitation.token} />
                              </div>
                            }
                          />
                        </Alert>
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

const AcceptOrganisationInvitationButton = ({ token }: { token: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const {
    mutateAsync: acceptOrganisationInvitation,
    isPending,
    isSuccess,
  } = trpc.organisation.member.invite.accept.useMutation({
    onSuccess: async () => {
      await refreshSession();

      toast({
        title: _(msg`Success`),
        description: _(msg`Invitation accepted`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to join this organisation at this time.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Button
      onClick={async () => acceptOrganisationInvitation({ token })}
      loading={isPending}
      disabled={isPending || isSuccess}
    >
      <Trans>Accept</Trans>
    </Button>
  );
};

const DeclineOrganisationInvitationButton = ({ token }: { token: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const {
    mutateAsync: declineOrganisationInvitation,
    isPending,
    isSuccess,
  } = trpc.organisation.member.invite.decline.useMutation({
    onSuccess: async () => {
      await refreshSession();

      toast({
        title: _(msg`Success`),
        description: _(msg`Invitation declined`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to decline this invitation at this time.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Button
      onClick={async () => declineOrganisationInvitation({ token })}
      loading={isPending}
      disabled={isPending || isSuccess}
      variant="ghost"
    >
      <Trans>Decline</Trans>
    </Button>
  );
};
