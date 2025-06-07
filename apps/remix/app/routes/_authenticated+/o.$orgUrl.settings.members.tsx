import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link, useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { OrganisationMemberInviteDialog } from '~/components/dialogs/organisation-member-invite-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationMemberInvitesTable } from '~/components/tables/organisation-member-invites-table';
import { OrganisationMembersDataTable } from '~/components/tables/organisation-members-table';

export default function TeamsSettingsMembersPage() {
  const { _ } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const currentTab = searchParams?.get('tab') === 'invites' ? 'invites' : 'members';

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

  return (
    <div>
      <SettingsHeader
        title={_(msg`Organisation Members`)}
        subtitle={_(msg`Manage the members or invite new members.`)}
      >
        <OrganisationMemberInviteDialog />
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
          <OrganisationMemberInvitesTable key="invites" />
        ) : (
          <OrganisationMembersDataTable key="members" />
        )}
      </div>
    </div>
  );
}
