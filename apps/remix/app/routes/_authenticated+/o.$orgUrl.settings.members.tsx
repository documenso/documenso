import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';
import { Link, useLocation, useSearchParams } from 'react-router';

import { OrganisationMemberInviteDialog } from '~/components/dialogs/organisation-member-invite-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationMemberInvitesTable } from '~/components/tables/organisation-member-invites-table';
import { OrganisationMembersDataTable } from '~/components/tables/organisation-members-table';

export default function TeamsSettingsMembersPage() {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  const currentTab = searchParams?.get('tab') === 'invites' ? 'invites' : 'members';

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={_(msg`Organisation Members`)}
        subtitle={_(msg`Manage the members or invite new members.`)}
      >
        <OrganisationMemberInviteDialog />
      </SettingsHeader>

      <div>
        <div className="my-4 flex flex-row items-center justify-between space-x-4">
          <Input
            value={searchQuery}
            onChange={(e) => void setSearchQuery(e.target.value || null)}
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
