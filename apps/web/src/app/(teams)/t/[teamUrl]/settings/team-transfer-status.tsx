'use client';

import { useRouter } from 'next/navigation';

import { AnimatePresence, motion } from 'framer-motion';

import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import type { TeamTransferVerification } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamTransferStatusProps = {
  className?: string;
  teamId: number;
  transferVerification: TeamTransferVerification | null;
};

export const TeamTransferStatus = ({
  className,
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
        <motion.div
          className={cn(
            'flex flex-row items-center justify-between rounded-lg border-2 border-yellow-400 bg-yellow-200 px-6 py-4 dark:border-yellow-600 dark:bg-yellow-400',
            className,
          )}
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
        >
          <div className="text-yellow-900">
            <h3 className="font-medium">
              {isExpired ? 'Team transfer request expired' : 'Team transfer in progress'}
            </h3>

            {isExpired ? (
              <p className="text-sm">
                The team transfer request to <strong>{transferVerification.name}</strong> has
                expired.
              </p>
            ) : (
              <section className="text-sm">
                <p>
                  A request to transfer the ownership of this team has been sent to{' '}
                  <strong>{transferVerification.name}</strong>
                </p>

                <p>If they accept this request, the team will be transferred to their account.</p>
              </section>
            )}
          </div>

          <Button
            onClick={async () => deleteTeamTransferRequest({ teamId })}
            loading={isLoading}
            variant="destructive"
            className="ml-auto mt-2"
          >
            {isExpired ? 'Close' : 'Cancel'}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
