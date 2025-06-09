import { Trans } from '@lingui/react/macro';
import type { TeamGroup } from '@prisma/client';

import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';

import { TeamMemberInheritDisableDialog } from '~/components/dialogs/team-inherit-member-disable-dialog';
import { TeamMemberInheritEnableDialog } from '~/components/dialogs/team-inherit-member-enable-dialog';

type TeamInheritMemberAlertProps = {
  memberAccessTeamGroup: TeamGroup | null;
};

export const TeamInheritMemberAlert = ({ memberAccessTeamGroup }: TeamInheritMemberAlertProps) => {
  return (
    <Alert
      className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
      variant="neutral"
    >
      <div className="mb-4 sm:mb-0">
        <AlertTitle>
          <Trans>Inherit organisation members</Trans>
        </AlertTitle>

        <AlertDescription className="mr-2">
          {memberAccessTeamGroup ? (
            <Trans>Currently all organisation members can access this team</Trans>
          ) : (
            <Trans>
              You can enable access to allow all organisation members to access this team by
              default.
            </Trans>
          )}
        </AlertDescription>
      </div>

      {memberAccessTeamGroup ? (
        <TeamMemberInheritDisableDialog group={memberAccessTeamGroup} />
      ) : (
        <TeamMemberInheritEnableDialog />
      )}
    </Alert>
  );
};
