import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { useCurrentTeam } from '~/providers/team';

type AiFeaturesEnableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnabled: () => void;
};

export const AiFeaturesEnableDialog = ({
  open,
  onOpenChange,
  onEnabled,
}: AiFeaturesEnableDialogProps) => {
  const { t } = useLingui();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const isTeamAdmin = team.currentTeamRole === TeamMemberRole.ADMIN;
  const isOrganisationAdmin = organisation.currentOrganisationRole === OrganisationMemberRole.ADMIN;
  const canEnableAiFeatures = isTeamAdmin || isOrganisationAdmin;

  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: updateTeamSettings, isPending: isUpdatingTeamSettings } =
    trpc.team.settings.update.useMutation();
  const { mutateAsync: updateOrganisationSettings, isPending: isUpdatingOrganisationSettings } =
    trpc.organisation.settings.update.useMutation();

  const isSubmitting = isUpdatingTeamSettings || isUpdatingOrganisationSettings;

  const onEnableClick = async () => {
    if (!canEnableAiFeatures) {
      return;
    }

    setError(null);

    try {
      if (isTeamAdmin) {
        await updateTeamSettings({
          teamId: team.id,
          data: { aiFeaturesEnabled: true },
        });
      } else {
        await updateOrganisationSettings({
          organisationId: organisation.id,
          data: { aiFeaturesEnabled: true },
        });
      }

      onEnabled();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to enable AI features', err);
      setError(
        err instanceof Error
          ? err.message
          : t`We couldn't enable AI features right now. Please try again.`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Enable AI features</Trans>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <Trans>
              Turn on AI detection to automatically find recipients and fields in your documents. AI
              providers do not retain your data for training.
            </Trans>
          </p>

          <Alert variant="neutral">
            <AlertDescription>
              <Trans>
                Your document content will be sent securely to our AI provider solely for detection
                and will not be stored or used for training.
              </Trans>
            </AlertDescription>
          </Alert>

          {canEnableAiFeatures ? (
            <p className="text-sm text-muted-foreground">
              <Trans>
                You're an admin. You can enable AI features for this team right away. Everyone on
                the team will see AI detection once enabled.
              </Trans>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Trans>
                AI features are disabled for your team. Please ask your team owner or organisation
                owner to enable them.
              </Trans>
            </p>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <Trans>Close</Trans>
          </Button>

          {canEnableAiFeatures ? (
            <Button type="button" onClick={() => void onEnableClick()} loading={isSubmitting}>
              <Trans>Enable AI features</Trans>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
