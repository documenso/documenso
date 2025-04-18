import { Link, Outlet } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { LimitsProvider } from '@documenso/ee-stub/server-only/limits/provider/client';
import { PortalComponent } from '~/components/general/portal';
import type { Route } from './+types/_layout';
import { SubscriptionStatus } from '@prisma/client';
import { TEAM_PLAN_LIMITS } from '@documenso/ee-stub/server-only/limits/constants';
import { TeamLayoutBillingBanner } from '~/components/general/teams/team-layout-billing-banner';
import { TeamProvider } from '~/providers/team';
import { Trans } from '@lingui/react/macro';
import { TrpcProvider } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useMemo } from 'react';
import { useSession } from '@documenso/lib/client-only/providers/session';

export default function Layout({ params }: Route.ComponentProps) {
  const { teams } = useSession();

  const currentTeam = teams.find((team) => team.url === params.teamUrl);

  const limits = useMemo(() => {
    if (!currentTeam) {
      return undefined;
    }

    if (
      currentTeam?.subscription &&
      currentTeam.subscription.status === SubscriptionStatus.INACTIVE
    ) {
      return {
        quota: {
          documents: 0,
          recipients: 0,
          directTemplates: 0,
        },
        remaining: {
          documents: 0,
          recipients: 0,
          directTemplates: 0,
        },
      };
    }

    return {
      quota: TEAM_PLAN_LIMITS,
      remaining: TEAM_PLAN_LIMITS,
    };
  }, [currentTeam?.subscription, currentTeam?.id]);

  if (!currentTeam) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never
                existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to="/settings/teams">
              <Trans>View teams</Trans>
            </Link>
          </Button>
        }
      ></GenericErrorLayout>
    );
  }

  const trpcHeaders = {
    'x-team-Id': currentTeam.id.toString(),
  };

  return (
    <TeamProvider team={currentTeam}>
      <LimitsProvider
        initialValue={{
          MAX_DOCUMENTS: 10,
          MAX_TEMPLATES: 5,
          MAX_TEAM_MEMBERS: 5,
          MAX_SIGNERS: 5,
          MAX_ADVANCED_FIELDS_COUNT: 5,
          MAX_SIGNING_ORDER: true,
        }}
        teamId={currentTeam.id}
      >
        <TrpcProvider headers={trpcHeaders}>
          {currentTeam?.subscription &&
            currentTeam.subscription.status !== SubscriptionStatus.ACTIVE && (
              <PortalComponent target="portal-header">
                <TeamLayoutBillingBanner
                  subscriptionStatus={currentTeam.subscription.status}
                  teamId={currentTeam.id}
                  userRole={currentTeam.currentTeamMember.role}
                />
              </PortalComponent>
            )}

          <main className="mt-8 pb-8 md:mt-12 md:pb-12">
            <Outlet />
          </main>
        </TrpcProvider>
      </LimitsProvider>
    </TeamProvider>
  );
}
