import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { TeamMemberInviteDialog } from '~/components/dialogs/team-member-invite-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamSettingsMemberInvitesTable } from '~/components/tables/team-settings-member-invites-table';
import { TeamSettingsMembersDataTable } from '~/components/tables/team-settings-members-table';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsMembersPage() {
  const { _ } = useLingui();

  const team = useCurrentTeam();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const currentTab = searchParams?.get('tab') === 'invites' ? 'invites' : 'members';

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    void navigate(`${pathname}?${params.toString()}`);
  }, [debouncedSearchQuery, pathname, navigate, searchParams]);

  return (
    <div>
      <SettingsHeader
        title={_(msg`Members`)}
        subtitle={_(msg`Manage the members or invite new members.`)}
      >
        <TeamMemberInviteDialog
          teamId={team.id}
          currentUserTeamRole={team.currentTeamMember.role}
        />
      </SettingsHeader>

      <div>
        <div className="my-4 flex flex-row items-center justify-between space-x-4">
          <Input
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={_(msg`Search`)}
          />

          <Tabs value={currentTab} className="flex-shrink-0 overflow-x-auto">
            <TabsList>
              <TabsTrigger className="min-w-[60px]" value="members" asChild>
                <Link to={pathname ?? '/'}>
                  <Trans>Active</Trans>
                </Link>
              </TabsTrigger>

              <TabsTrigger className="min-w-[60px]" value="invites" asChild>
                <Link to={`${pathname}?tab=invites`}>
                  <Trans>Pending</Trans>
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {currentTab === 'invites' ? (
          <TeamSettingsMemberInvitesTable key="invites" />
        ) : (
          <TeamSettingsMembersDataTable key="members" />
        )}
      </div>
    </div>
  );
}
