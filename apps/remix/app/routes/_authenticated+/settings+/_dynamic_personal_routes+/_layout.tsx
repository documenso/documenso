import { useEffect } from 'react';

import { Outlet, useNavigate } from 'react-router';

import { OrganisationProvider } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { TrpcProvider } from '@documenso/trpc/react';

import { TeamProvider } from '~/providers/team';

/**
 * These routes should only render if the user has:
 *
 * - 1 Personal organisation
 * - Nothing else
 *
 * This removes the UX complexity for users who only have a single personal organisation, instead of showing them multiple settings pages:
 *
 * - Organisation settings
 * - Teams settings
 */
export default function Layout() {
  const { organisations } = useSession();

  const navigate = useNavigate();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const currentOrganisation = organisations[0];
  const team = currentOrganisation?.teams[0] || null;

  useEffect(() => {
    if (!isPersonalLayoutMode || !team) {
      void navigate('/settings/profile');
    }
  }, []);

  if (!isPersonalLayoutMode || !team) {
    return null;
  }

  const trpcHeaders = {
    'x-team-Id': team.id.toString(),
  };

  return (
    <TrpcProvider headers={trpcHeaders}>
      <OrganisationProvider organisation={currentOrganisation}>
        <TeamProvider team={team}>
          <Outlet />
        </TeamProvider>
      </OrganisationProvider>
    </TrpcProvider>
  );
}
