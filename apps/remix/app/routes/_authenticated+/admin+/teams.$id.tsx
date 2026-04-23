import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CopyIcon } from 'lucide-react';
import { Link } from 'react-router';

import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminTeamResponse } from '@documenso/trpc/server/admin-router/get-admin-team.types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminTeamMemberDeleteDialog } from '~/components/dialogs/admin-team-member-delete-dialog';
import { DetailsCard, DetailsValue } from '~/components/general/admin-details';
import { AdminGlobalSettingsSection } from '~/components/general/admin-global-settings-section';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/teams.$id';

export default function AdminTeamPage({ params }: Route.ComponentProps) {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const teamId = Number(params.id);

  const { data: team, isLoading } = trpc.admin.team.get.useQuery(
    {
      teamId,
    },
    {
      enabled: Number.isFinite(teamId) && teamId > 0,
    },
  );

  const onCopyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);

    toast({
      title: _(msg`Copied to clipboard`),
    });
  };

  const teamMembersColumns = useMemo(() => {
    if (!team) {
      return [];
    }

    return [
      {
        header: _(msg`Member`),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link
              className="font-medium hover:underline"
              to={`/admin/users/${row.original.user.id}`}
            >
              {row.original.user.name ?? row.original.user.email}
            </Link>
            {row.original.user.name && (
              <div className="font-mono text-xs text-muted-foreground">
                {row.original.user.email}
              </div>
            )}
          </div>
        ),
      },
      {
        header: _(msg`User ID`),
        accessorKey: 'userId',
      },
      {
        header: _(msg`Team role`),
        accessorKey: 'teamRole',
        cell: ({ row }) => (
          <Badge variant="secondary">{_(TEAM_MEMBER_ROLE_MAP[row.original.teamRole])}</Badge>
        ),
      },
      {
        header: _(msg`Organisation role`),
        accessorKey: 'organisationRole',
        cell: ({ row }) => {
          const isOwner = row.original.userId === team.organisation.ownerUserId;

          if (isOwner) {
            return <Badge>{_(msg`Owner`)}</Badge>;
          }

          return (
            <Badge variant="secondary">
              {_(ORGANISATION_MEMBER_ROLE_MAP[row.original.organisationRole])}
            </Badge>
          );
        },
      },
      {
        header: _(msg`Joined`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => {
          const isOwner = row.original.userId === team.organisation.ownerUserId;

          if (isOwner) {
            return null;
          }

          const memberName = row.original.user.name ?? row.original.user.email;

          return (
            <div className="flex justify-end">
              <AdminTeamMemberDeleteDialog
                teamId={team.id}
                teamName={team.name}
                memberId={row.original.id}
                memberName={memberName}
                memberEmail={row.original.user.email}
              />
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<TGetAdminTeamResponse['teamMembers'][number]>[];
  }, [team, _, i18n]);

  const pendingInvitesColumns = useMemo(() => {
    return [
      {
        header: _(msg`Email`),
        accessorKey: 'email',
      },
      {
        header: _(msg`Role`),
        accessorKey: 'organisationRole',
        cell: ({ row }) => _(ORGANISATION_MEMBER_ROLE_MAP[row.original.organisationRole]),
      },
      {
        header: _(msg`Invited`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
    ] satisfies DataTableColumnDef<TGetAdminTeamResponse['pendingInvites'][number]>[];
  }, [_, i18n]);

  if (!Number.isFinite(teamId) || teamId <= 0) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  if (isLoading) {
    return <SpinnerBox className="py-32" />;
  }

  if (!team) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <SettingsHeader title={_(msg`Manage team`)} subtitle={_(msg`Manage the ${team.name} team`)}>
        <Button variant="outline" asChild>
          <Link to={`/admin/organisations/${team.organisation.id}`}>
            <Trans>Manage organisation</Trans>
          </Link>
        </Button>
      </SettingsHeader>

      <div className="mt-8 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">
            <Trans>Team details</Trans>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Trans>Key identifiers and relationships for this team.</Trans>
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailsCard
            label={<Trans>Team ID</Trans>}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => void onCopyToClipboard(String(team.id))}
                title={_(msg`Copy team ID`)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            }
          >
            <DetailsValue isSelectable>{team.id}</DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Team URL</Trans>}>
            <DetailsValue isSelectable>{team.url}</DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Created</Trans>}>
            <DetailsValue>{i18n.date(team.createdAt)}</DetailsValue>
          </DetailsCard>

          <DetailsCard label={<Trans>Members</Trans>}>
            <DetailsValue>{team.memberCount}</DetailsValue>
          </DetailsCard>

          <DetailsCard
            label={<Trans>Organisation ID</Trans>}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => void onCopyToClipboard(team.organisation.id)}
                title={_(msg`Copy organisation ID`)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            }
          >
            <DetailsValue isSelectable>{team.organisation.id}</DetailsValue>
          </DetailsCard>

          {team.teamEmail && (
            <>
              <DetailsCard label={<Trans>Team email</Trans>}>
                <DetailsValue isSelectable>{team.teamEmail.email}</DetailsValue>
              </DetailsCard>

              <DetailsCard label={<Trans>Team email name</Trans>}>
                <DetailsValue>{team.teamEmail.name}</DetailsValue>
              </DetailsCard>
            </>
          )}
        </div>
      </div>

      {team.teamGlobalSettings && (
        <div className="mt-8 rounded-lg border p-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="global-settings" className="border-b-0">
              <AccordionTrigger className="py-0">
                <div className="text-left">
                  <p className="text-sm font-medium">
                    <Trans>Global Settings</Trans>
                  </p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    <Trans>
                      Default settings applied to this team. Inherited values come from the
                      organisation.
                    </Trans>
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mt-4">
                  <AdminGlobalSettingsSection settings={team.teamGlobalSettings} isTeam />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <div className="mt-8">
        <p className="text-sm font-medium">
          <Trans>Team Members</Trans>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans>Members that currently belong to this team.</Trans>
        </p>

        <div className="mt-4">
          <DataTable columns={teamMembersColumns} data={team.teamMembers} />
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium">
          <Trans>Pending Organisation Invites</Trans>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans>Organisation-level pending invites for this team's parent organisation.</Trans>
        </p>

        <div className="mt-4">
          <DataTable columns={pendingInvitesColumns} data={team.pendingInvites} />
        </div>
      </div>
    </div>
  );
}
