import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import {
  OrganisationGroupType,
  OrganisationMemberRole,
  type TeamGroup,
  TeamMemberRole,
} from '@prisma/client';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { TeamGroupCreateDialog } from '~/components/dialogs/team-group-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamGroupsTable } from '~/components/tables/team-groups-table';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsGroupsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();

  const { pathname } = useLocation();
  const team = useCurrentTeam();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    // If nothing  to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  const everyoneGroupQuery = trpc.team.group.find.useQuery({
    teamId: team.id,
    types: [OrganisationGroupType.INTERNAL_ORGANISATION],
    organisationRoles: [OrganisationMemberRole.MEMBER],
    perPage: 1,
  });

  const memberAccessTeamGroup = everyoneGroupQuery.data?.data[0] || null;

  return (
    <div>
      <SettingsHeader title={t`Team Groups`} subtitle={t`Manage the groups assigned to this team.`}>
        <TeamGroupCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamGroupsTable />

      {everyoneGroupQuery.isFetched && (
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
            <TeamMemberInheritDisableSetting group={memberAccessTeamGroup} teamId={team.id} />
          ) : (
            <TeamMemberInheritEnableSetting />
          )}
        </Alert>
      )}
    </div>
  );
}

const TeamMemberInheritEnableSetting = () => {
  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: createTeamGroups, isPending } = trpc.team.group.createMany.useMutation({
    onSuccess: () => {
      toast({
        title: t`Access enabled`,
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We encountered an unknown error while attempting to enable access.`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const organisationGroupQuery = trpc.organisation.group.find.useQuery({
    organisationId: organisation.id,
    perPage: 1,
    types: [OrganisationGroupType.INTERNAL_ORGANISATION],
    organisationRoles: [OrganisationMemberRole.MEMBER],
  });

  const enableAccessGroup = async () => {
    if (!organisationGroupQuery.data?.data[0]?.id) {
      return;
    }

    await createTeamGroups({
      teamId: team.id,
      groups: [
        {
          organisationGroupId: organisationGroupQuery.data?.data[0]?.id,
          teamRole: TeamMemberRole.MEMBER,
        },
      ],
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Enable access</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to give all organisation members access to this team under the team
              member role.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button
            type="submit"
            disabled={organisationGroupQuery.isPending}
            loading={isPending}
            onClick={enableAccessGroup}
          >
            <Trans>Enable</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type TeamMemberInheritDisableSettingProps = {
  group: TeamGroup;
  teamId: number;
};

const TeamMemberInheritDisableSetting = ({
  group,
  teamId,
}: TeamMemberInheritDisableSettingProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const deleteGroupMutation = trpc.team.group.delete.useMutation({
    onSuccess: () => {
      toast({
        title: t`Access disabled`,
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We encountered an unknown error while attempting to disable access.`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Disable access</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to remove default access to this team for all organisation members. Any
              members part of another group associated with this team will still retain their
              access.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button
            type="submit"
            variant="destructive"
            loading={deleteGroupMutation.isPending}
            onClick={() =>
              deleteGroupMutation.mutate({
                teamId,
                teamGroupId: group.id,
              })
            }
          >
            <Trans>Disable</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
