import { useMemo } from 'react';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Building2Icon, InboxIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, redirect } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ScrollArea, ScrollBar } from '@documenso/ui/primitives/scroll-area';

import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { InboxTable } from '~/components/tables/inbox-table';
import { appMetaTags } from '~/utils/meta';

export function loader() {
  throw redirect('/');
}

export function meta() {
  return appMetaTags('Dashboard');
}

export default function DashboardPage() {
  const { t } = useLingui();

  const { user, organisations } = useSession();

  // Todo: Sort by recent access (TBD by cookies)
  // Teams, flattened with the organisation data still attached.
  const teams = useMemo(() => {
    return organisations.flatMap((org) =>
      org.teams.map((team) => ({
        ...team,
        organisation: {
          ...org,
          teams: undefined,
        },
      })),
    );
  }, [organisations]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            <Trans>Dashboard</Trans>
          </h1>
          <p className="text-muted-foreground mt-1">
            <Trans>Welcome back! Here's an overview of your account.</Trans>
          </p>

          <OrganisationInvitations className="mt-4" />
        </div>

        {organisations.length === 0 && (
          <div className="mb-12 mt-6 flex flex-col items-center justify-center rounded-lg border py-32">
            <Building2Icon className="h-10 w-10" />

            <div className="mt-2 flex flex-col items-center gap-0.5">
              <p className="font-semibold">
                <Trans>No organisations found</Trans>
              </p>
              <p className="text-muted-foreground text-sm">
                <Trans>Create an organisation to get started.</Trans>
              </p>
            </div>

            <Button asChild className="mt-4" variant="outline">
              <Link to="/settings/organisations?action=add-organisation">
                <Trans>Create organisation</Trans>
              </Link>
            </Button>
          </div>
        )}

        {/* Organisations Section */}
        {organisations.length > 1 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2Icon className="text-muted-foreground h-5 w-5" />
                <h2 className="text-xl font-semibold">
                  <Trans>Organisations</Trans>
                </h2>
              </div>

              {/* Right hand side action if required. */}
              {/* <Button variant="outline" size="sm" className="gap-1">
                <PlusIcon className="h-4 w-4" />
                <Trans>New</Trans>
              </Button> */}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organisations.map((org) => (
                <div key={org.id} className="group relative">
                  <Link to={`/org/${org.url}`}>
                    <Card className="hover:bg-muted/50 h-full border pr-6 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-solid">
                            {org.avatarImageId && (
                              <AvatarImage src={formatAvatarUrl(org.avatarImageId)} />
                            )}
                            <AvatarFallback className="text-sm text-gray-400">
                              {org.name.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <h3 className="font-medium">{org.name}</h3>
                            <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <UsersIcon className="h-3 w-3" />
                                <span>
                                  {org.ownerUserId === user.id
                                    ? t`Owner`
                                    : t(ORGANISATION_MEMBER_ROLE_MAP[org.currentOrganisationRole])}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Building2Icon className="h-3 w-3" />
                                <span>
                                  <Plural
                                    value={org.teams.length}
                                    one={<Trans># team</Trans>}
                                    other={<Trans># teams</Trans>}
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {canExecuteOrganisationAction(
                    'MANAGE_ORGANISATION',
                    org.currentOrganisationRole,
                  ) && (
                    <div className="text-muted-foreground absolute right-4 top-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Link to={`/org/${org.url}/settings`}>
                        <SettingsIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teams Section */}
        {teams.length >= 1 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersIcon className="text-muted-foreground h-5 w-5" />
                <h2 className="text-xl font-semibold">
                  <Trans>Teams</Trans>
                </h2>
              </div>
              {/* <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="gap-1">
                <Trans>View all</Trans>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </Button> */}
            </div>

            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex gap-4">
                {teams.map((team) => (
                  <div key={team.id} className="group relative">
                    <Link to={`/t/${team.url}`}>
                      <Card className="hover:bg-muted/50 w-[350px] shrink-0 border transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-solid">
                              {team.avatarImageId && (
                                <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />
                              )}
                              <AvatarFallback className="text-sm text-gray-400">
                                {team.name.slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                              <h3 className="font-medium">{team.name}</h3>
                              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1">
                                  <UsersIcon className="h-3 w-3" />
                                  {team.organisation.ownerUserId === user.id
                                    ? t`Owner`
                                    : t(TEAM_MEMBER_ROLE_MAP[team.currentTeamRole])}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Building2Icon className="h-3 w-3" />
                                  <span className="truncate">{team.organisation.name}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-muted-foreground mt-3 text-xs">
                            <Trans>
                              Joined{' '}
                              {DateTime.fromJSDate(team.createdAt).toRelative({ style: 'short' })}
                            </Trans>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    {canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole) && (
                      <div className="text-muted-foreground absolute right-4 top-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Link to={`/t/${team.url}/settings`}>
                          <SettingsIcon className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {/* Inbox Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <InboxIcon className="text-muted-foreground h-5 w-5" />
              <h2 className="text-xl font-semibold">
                <Trans>Personal Inbox</Trans>
              </h2>
            </div>
            {/* <Button variant="ghost" size="sm" asChild>
              <Link to="/inbox" className="gap-1">
                <span>
                  <Trans>View all</Trans>
                </span>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </Button> */}
          </div>

          <InboxTable />
        </div>
      </div>
    </div>
  );
}
