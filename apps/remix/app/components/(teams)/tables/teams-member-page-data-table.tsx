import { useEffect, useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import type { TeamMemberRole } from '@prisma/client';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { TeamMemberInvitesDataTable } from '~/components/(teams)/tables/team-member-invites-data-table';
import { TeamMembersDataTable } from '~/components/(teams)/tables/team-members-data-table';

export type TeamsMemberPageDataTableProps = {
  currentUserTeamRole: TeamMemberRole;
  teamId: number;
  teamName: string;
  teamOwnerUserId: number;
};

export const TeamsMemberPageDataTable = ({
  currentUserTeamRole,
  teamId,
  teamName,
  teamOwnerUserId,
}: TeamsMemberPageDataTableProps) => {
  const { _ } = useLingui();

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
        <TeamMemberInvitesDataTable key="invites" teamId={teamId} />
      ) : (
        <TeamMembersDataTable
          key="members"
          currentUserTeamRole={currentUserTeamRole}
          teamId={teamId}
          teamName={teamName}
          teamOwnerUserId={teamOwnerUserId}
        />
      )}
    </div>
  );
};
