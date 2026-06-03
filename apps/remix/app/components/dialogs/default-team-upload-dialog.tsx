// ABOUTME: Dialog shown when a user tries to upload a document while in the Default team.
// ABOUTME: Nudges them to select a purpose-specific team or continue in Default anyway.
import { Trans } from '@lingui/react/macro';
import { ArrowRightIcon, UsersIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

export type DefaultTeamUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
};

export const DefaultTeamUploadDialog = ({
  open,
  onOpenChange,
  onContinue,
}: DefaultTeamUploadDialogProps) => {
  const navigate = useNavigate();
  const { organisations } = useSession();

  const otherTeams = organisations
    .flatMap((org) => org.teams)
    .filter((team) => team.url !== 'default');

  const handleTeamClick = async (teamUrl: string) => {
    onOpenChange(false);
    await navigate(formatDocumentsPath(teamUrl));
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Choose the right team for your document</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Documents in the Default team are visible to all staff. To keep your documents private
              and organized, upload to your department's team instead.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {otherTeams.length > 0 ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                <Trans>Your teams</Trans>
              </p>

              <ul className="flex flex-col gap-1">
                {otherTeams.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => void handleTeamClick(team.url)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{team.name}</span>
                      </span>

                      <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Trans>Don't have a team yet? Request one from IT.</Trans>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button type="button" variant="secondary" onClick={handleContinue}>
            <Trans>Continue in Default</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
