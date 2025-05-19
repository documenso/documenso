import { Outlet } from 'react-router';

import type { Route } from './+types/_layout';

export default function Layout({ params }: Route.ComponentProps) {
  // Todo: orgs
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      {/* {currentOrganisation.subscription &&
        currentOrganisation.subscription.status !== SubscriptionStatus.ACTIVE && (
          <PortalComponent target="portal-header">
            <OrganisationBillingBanner
              subscriptionStatus={currentOrganisation.subscription.status}
              teamId={currentOrganisation.id}
              userRole={currentOrganisation.currentTeamMember.role}
            />
          </PortalComponent>
        )} */}

      <Outlet />
    </div>
  );
}
