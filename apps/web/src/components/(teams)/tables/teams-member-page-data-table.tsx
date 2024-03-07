'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TeamMemberRole } from '@documenso/prisma/client';
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearchQuery, pathname, router, searchParams]);

  return (
    <div>
      <div className="my-4 flex flex-row items-center justify-between space-x-4">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
        />

        <Tabs value={currentTab} className="flex-shrink-0 overflow-x-auto">
          <TabsList>
            <TabsTrigger className="min-w-[60px]" value="members" asChild>
              <Link href={pathname ?? '/'}>Active</Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value="invites" asChild>
              <Link href={`${pathname}?tab=invites`}>Pending</Link>
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
