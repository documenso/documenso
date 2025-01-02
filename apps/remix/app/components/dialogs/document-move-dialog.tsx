import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
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

type DocumentMoveDialogProps = {
  documentId: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DocumentMoveDialog = ({ documentId, open, onOpenChange }: DocumentMoveDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const { data: teams, isPending: isLoadingTeams } = trpc.team.getTeams.useQuery();

  const { mutateAsync: moveDocument, isPending } = trpc.document.moveDocumentToTeam.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Document moved`),
        description: _(msg`The document has been successfully moved to the selected team.`),
        duration: 5000,
      });

      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: _(msg`Error`),
        description: error.message || _(msg`An error occurred while moving the document.`),
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const onMove = async () => {
    if (!selectedTeamId) {
      return;
    }

    await moveDocument({ documentId, teamId: selectedTeamId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Move Document to Team</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Select a team to move this document to. This action cannot be undone.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Select onValueChange={(value) => setSelectedTeamId(Number(value))}>
          <SelectTrigger>
            <SelectValue placeholder={_(msg`Select a team`)} />
          </SelectTrigger>
          <SelectContent>
            {isLoadingTeams ? (
              <SelectItem value="loading" disabled>
                <Trans>Loading teams...</Trans>
              </SelectItem>
            ) : (
              teams?.map((team) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-8 w-8">
                      {team.avatarImageId && (
                        <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />
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
            <Trans>Cancel</Trans>
          </Button>
          <Button onClick={onMove} loading={isPending} disabled={!selectedTeamId || isPending}>
            {isPending ? <Trans>Moving...</Trans> : <Trans>Move</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
