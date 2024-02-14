'use client';

import { useRouter } from 'next/navigation';

import { AnimatePresence } from 'framer-motion';

import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import type { TeamMemberRole, TeamTransferVerification } from '@documenso/prisma/client';
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
  const router = useRouter();

  const { toast } = useToast();

  const isExpired = transferVerification && isTokenExpired(transferVerification.expiresAt);

  const { mutateAsync: deleteTeamTransferRequest, isLoading } =
    trpc.team.deleteTeamTransferRequest.useMutation({
      onSuccess: () => {
        if (!isExpired) {
          toast({
            title: 'Success',
            description: 'The team transfer invitation has been successfully deleted.',
            duration: 5000,
          });
        }

        router.refresh();
      },
      onError: () => {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to remove this transfer. Please try again or contact support.',
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
                {isExpired ? 'Team transfer request expired' : 'Team transfer in progress'}
              </AlertTitle>

              <AlertDescription>
                {isExpired ? (
                  <p className="text-sm">
                    The team transfer request to <strong>{transferVerification.name}</strong> has
                    expired.
                  </p>
                ) : (
                  <section className="text-sm">
                    <p>
                      A request to transfer the ownership of this team has been sent to{' '}
                      <strong>
                        {transferVerification.name} ({transferVerification.email})
                      </strong>
                    </p>

                    <p>
                      If they accept this request, the team will be transferred to their account.
                    </p>
                  </section>
                )}
              </AlertDescription>
            </div>

            {canExecuteTeamAction('DELETE_TEAM_TRANSFER_REQUEST', currentUserTeamRole) && (
              <Button
                onClick={async () => deleteTeamTransferRequest({ teamId })}
                loading={isLoading}
                variant={isExpired ? 'destructive' : 'ghost'}
                className={cn('ml-auto', {
                  'hover:bg-transparent hover:text-blue-800': !isExpired,
                })}
              >
                {isExpired ? 'Close' : 'Cancel'}
              </Button>
            )}
          </Alert>
        </AnimateGenericFadeInOut>
      )}
    </AnimatePresence>
  );
};
