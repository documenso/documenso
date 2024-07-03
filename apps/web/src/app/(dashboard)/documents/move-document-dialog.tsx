import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

type MoveDocumentDialogProps = {
  documentId: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const MoveDocumentDialog = ({ documentId, open, onOpenChange }: MoveDocumentDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const { data: teams, isLoading: isLoadingTeams } = trpc.team.getTeams.useQuery();
  const { mutateAsync: moveDocument, isLoading } = trpc.document.moveDocumentToTeam.useMutation({
    onSuccess: () => {
      router.refresh();
      toast({
        title: 'Document moved',
        description: 'The document has been successfully moved to the selected team.',
        duration: 5000,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while moving the document.',
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const onMove = async () => {
    if (!selectedTeamId) return;
    await moveDocument({ documentId, teamId: selectedTeamId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Document to Team</DialogTitle>
          <DialogDescription>
            Select a team to move this document to. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Select onValueChange={(value) => setSelectedTeamId(Number(value))}>
          <SelectTrigger>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingTeams ? (
              <SelectItem value="loading" disabled>
                Loading teams...
              </SelectItem>
            ) : (
              teams?.map((team) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-8 w-8">
                      {team.avatarImageId && (
                        <AvatarImage
                          src={`${NEXT_PUBLIC_WEBAPP_URL()}/api/avatar/${team.avatarImageId}`}
                        />
                      )}

                      <AvatarFallback className="text-sm text-gray-400">
                        {team.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <span>{team.name}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onMove} loading={isLoading} disabled={!selectedTeamId || isLoading}>
            {isLoading ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
