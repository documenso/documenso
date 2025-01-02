import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TeamMemberRole, TeamTransferVerification } from '@prisma/client';
import { AnimatePresence } from 'framer-motion';
import { useRevalidator } from 'react-router';

import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamTransferStatusProps = {
  className?: string;
  currentUserTeamRole: TeamMemberRole;
  teamId: number;
  transferVerification: Pick<TeamTransferVerification, 'email' | 'expiresAt' | 'name'> | null;
};

export const TeamTransferStatus = ({
  className,
  currentUserTeamRole,
  teamId,
  transferVerification,
}: TeamTransferStatusProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const isExpired = transferVerification && isTokenExpired(transferVerification.expiresAt);

  const { mutateAsync: deleteTeamTransferRequest, isPending } =
    trpc.team.deleteTeamTransferRequest.useMutation({
      onSuccess: async () => {
        if (!isExpired) {
          toast({
            title: _(msg`Success`),
            description: _(msg`The team transfer invitation has been successfully deleted.`),
            duration: 5000,
          });
        }

        await revalidate();
      },
      onError: () => {
        toast({
          title: _(msg`An unknown error occurred`),
          description: _(
            msg`We encountered an unknown error while attempting to remove this transfer. Please try again or contact support.`,
          ),
          variant: 'destructive',
        });
      },
    });

  return (
    <AnimatePresence>
      {transferVerification && (
        <AnimateGenericFadeInOut>
          <Alert
            variant={isExpired ? 'destructive' : 'warning'}
            className={cn(
              'flex flex-col justify-between p-6 sm:flex-row sm:items-center',
              className,
            )}
          >
            <div>
              <AlertTitle>
                {isExpired ? (
                  <Trans>Team transfer request expired</Trans>
                ) : (
                  <Trans>Team transfer in progress</Trans>
                )}
              </AlertTitle>

              <AlertDescription>
                {isExpired ? (
                  <p className="text-sm">
                    <Trans>
                      The team transfer request to <strong>{transferVerification.name}</strong> has
                      expired.
                    </Trans>
                  </p>
                ) : (
                  <section className="text-sm">
                    <p>
                      <Trans>
                        A request to transfer the ownership of this team has been sent to{' '}
                        <strong>
                          {transferVerification.name} ({transferVerification.email})
                        </strong>
                      </Trans>
                    </p>

                    <p>
                      <Trans>
                        If they accept this request, the team will be transferred to their account.
                      </Trans>
                    </p>
                  </section>
                )}
              </AlertDescription>
            </div>

            {canExecuteTeamAction('DELETE_TEAM_TRANSFER_REQUEST', currentUserTeamRole) && (
              <Button
                onClick={async () => deleteTeamTransferRequest({ teamId })}
                loading={isPending}
                variant={isExpired ? 'destructive' : 'ghost'}
                className={cn('ml-auto', {
                  'hover:bg-transparent hover:text-blue-800': !isExpired,
                })}
              >
                {isExpired ? <Trans>Close</Trans> : <Trans>Cancel</Trans>}
              </Button>
            )}
          </Alert>
        </AnimateGenericFadeInOut>
      )}
    </AnimatePresence>
  );
};
