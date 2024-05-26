import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PendingUserTeamsDataTableActionsProps = {
  className?: string;
  pendingTeamId: number;
  onPayClick: (pendingTeamId: number) => void;
};

export const PendingUserTeamsDataTableActions = ({
  className,
  pendingTeamId,
  onPayClick,
}: PendingUserTeamsDataTableActionsProps) => {
  const { toast } = useToast();

  const { mutateAsync: deleteTeamPending, isLoading: deletingTeam } =
    trpc.team.deleteTeamPending.useMutation({
      onSuccess: () => {
        toast({
          title: '',
          description: 'მოლოდინში მყოფი გუნდი წაიშალა.',
          // description: 'Pending team deleted.',
        });
      },
      onError: () => {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: 'მოლოდინში მყოფი გუნდის წაშლისას დაფიქსირდა ხარვეზი. გთხოვთ სცადოთ თავიდან.',
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  return (
    <fieldset disabled={deletingTeam} className={cn('flex justify-end space-x-2', className)}>
      <Button variant="outline" onClick={() => onPayClick(pendingTeamId)}>
        გადახდა
      </Button>

      <Button
        variant="destructive"
        loading={deletingTeam}
        onClick={async () => deleteTeamPending({ pendingTeamId: pendingTeamId })}
      >
        {/* Remove */}
        წაშლა
      </Button>
    </fieldset>
  );
};
