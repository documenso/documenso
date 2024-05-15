'use client';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamBillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
  teamId: number;
};

export const TeamBillingPortalButton = ({ buttonProps, teamId }: TeamBillingPortalButtonProps) => {
  const { toast } = useToast();

  const { mutateAsync: createBillingPortal, isLoading } =
    trpc.team.createBillingPortal.useMutation();

  const handleCreatePortal = async () => {
    try {
      const sessionUrl = await createBillingPortal({ teamId });

      window.open(sessionUrl, '_blank');
    } catch (err) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'გადახდების პორტალზე გადასვლა ვერ მოხერხდა. გთხოვთ სცადოთ თავიდან ან დაგვიკავშირდეთ.',
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  return (
    <Button {...buttonProps} onClick={async () => handleCreatePortal()} loading={isLoading}>
      პაკეტის მართვა
    </Button>
  );
};
