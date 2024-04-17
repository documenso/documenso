'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { trpc } from '@documenso/trpc/react';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { CurrentUserTeamsDataTable } from './current-user-teams-data-table';
import { PendingUserTeamsDataTable } from './pending-user-teams-data-table';

export const UserSettingsTeamsPageDataTable = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const currentTab = searchParams?.get('tab') === 'pending' ? 'pending' : 'active';

  const { data } = trpc.team.findTeamsPending.useQuery(
    {},
    {
      keepPreviousData: true,
    },
  );

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
            <TabsTrigger className="min-w-[60px]" value="active" asChild>
              <Link href={pathname ?? '/'}>Active</Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value="pending" asChild>
              <Link href={`${pathname}?tab=pending`}>
                Pending
                {data && data.count > 0 && (
                  <span className="ml-1 hidden opacity-50 md:inline-block">{data.count}</span>
                )}
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {currentTab === 'pending' ? <PendingUserTeamsDataTable /> : <CurrentUserTeamsDataTable />}
    </div>
  );
};
