import { Trans, useLingui } from '@lingui/react/macro';
import {
  ArrowRight,
  CalendarIcon,
  MoreVerticalIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { canExecuteTeamAction, formatTeamUrl } from '@documenso/lib/utils/teams';
import type { TGetOrganisationSessionResponse } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { TeamDeleteDialog } from '~/components/dialogs/team-delete-dialog';

export default function OrganisationSettingsTeamsPage() {
  const { t, i18n } = useLingui();

  const organisation = useCurrentOrganisation();

  // No teams view.
  if (organisation.teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <div className="bg-muted mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <UsersIcon className="text-muted-foreground h-10 w-10" />
        </div>

        <h2 className="mb-2 text-xl font-semibold">
          <Trans>No teams yet</Trans>
        </h2>

        {canExecuteOrganisationAction(
          'MANAGE_ORGANISATION',
          organisation.currentOrganisationRole,
        ) ? (
          <>
            <p className="text-muted-foreground mb-8 max-w-md text-center text-sm">
              <Trans>
                Teams help you organize your work and collaborate with others. Create your first
                team to get started.
              </Trans>
            </p>

            <TeamCreateDialog
              trigger={
                <Button className="flex items-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  <Trans>Create team</Trans>
                </Button>
              }
            />

            <div className="mt-12 max-w-md rounded-lg border px-8 py-6">
              <h3 className="mb-2 font-medium">
                <Trans>What you can do with teams:</Trans>
              </h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li className="flex flex-row items-center gap-2">
                  <div className="bg-muted mt-0.5 flex h-5 w-5 items-center justify-center rounded-full font-bold">
                    <span className="text-xs">1</span>
                  </div>
                  <Trans>Organize your documents and templates</Trans>
                </li>
                <li className="flex flex-row items-center gap-2">
                  <div className="bg-muted mt-0.5 flex h-5 w-5 items-center justify-center rounded-full font-bold">
                    <span className="text-xs">2</span>
                  </div>
                  <Trans>Invite team members to collaborate</Trans>
                </li>
                <li className="flex flex-row items-center gap-2">
                  <div className="bg-muted mt-0.5 flex h-5 w-5 items-center justify-center rounded-full font-bold">
                    <span className="text-xs">3</span>
                  </div>
                  <Trans>Manage permissions and access controls</Trans>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground mb-8 max-w-md text-center text-sm">
            <Trans>
              You currently have no access to any teams within this organisation. Please contact
              your organisation to request access.
            </Trans>
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-row justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <Trans>{organisation.name} Teams</Trans>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>Select a team to view its dashboard</Trans>
          </p>
        </div>

        <Button asChild>
          <Link to={`/org/${organisation.url}/settings`}>Manage Organisation</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organisation.teams.map((team) => (
          <Link to={`/t/${team.url}`} key={team.id}>
            <Card className="hover:bg-muted/50 border-border h-full border transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-solid">
                    {team.avatarImageId && (
                      <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />
                    )}
                    <AvatarFallback className="text-sm text-gray-400">
                      {team.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{team.name}</h3>
                        <div className="text-muted-foreground truncate text-xs">
                          {formatTeamUrl(team.url)}
                        </div>
                      </div>

                      <TeamDropdownMenu team={team} />
                    </div>

                    <div className="mt-2 flex items-center gap-4">
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <CalendarIcon className="h-3 w-3" />
                        {i18n.date(team.createdAt, { dateStyle: 'short' })}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <UserIcon className="h-3 w-3" />
                        <span>{t(TEAM_MEMBER_ROLE_MAP[team.currentTeamRole])}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

const TeamDropdownMenu = ({ team }: { team: TGetOrganisationSessionResponse[0]['teams'][0] }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVerticalIcon className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link to={`/t/${team.url}`}>
            <ArrowRight className="mr-2 h-4 w-4" />
            <Trans>Go to team</Trans>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/t/${team.url}/settings`}>
            <SettingsIcon className="mr-2 h-4 w-4" />
            <Trans>Settings</Trans>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/t/${team.url}/settings/members`}>
            <UsersIcon className="mr-2 h-4 w-4" />
            <Trans>Members</Trans>
          </Link>
        </DropdownMenuItem>

        {canExecuteTeamAction('DELETE_TEAM', team.currentTeamRole) && (
          <>
            <DropdownMenuSeparator />

            <TeamDeleteDialog
              teamId={team.id}
              teamName={team.name}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <TrashIcon className="mr-2 h-4 w-4" />
                  <Trans>Delete</Trans>
                </DropdownMenuItem>
              }
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
