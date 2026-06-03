import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Link, Outlet } from 'react-router';

import { PAID_PLAN_LIMITS } from '@documenso/ee/server-only/limits/constants';
import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { TrpcProvider } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { useOptionalCurrentTeam } from '~/providers/team';

export default function Layout() {
  const team = useOptionalCurrentTeam();
  const organisation = useOptionalCurrentOrganisation();

  const limits = useMemo(() => {
    if (!organisation) {
      return undefined;
    }

    return {
      quota: PAID_PLAN_LIMITS,
      remaining: PAID_PLAN_LIMITS,
      maximumEnvelopeItemCount: Number.MAX_SAFE_INTEGER,
    };
  }, [organisation?.subscription]);

  if (!team) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team not found`,
            subHeading: msg`404 Team not found`,
            message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
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
    'x-team-Id': team.id.toString(),
  };

  // Note: We use a key to force a re-render if the team context changes.
  // This is required otherwise you would see the wrong page content.
  return (
    <div key={team.url}>
      <TrpcProvider headers={trpcHeaders}>
        <LimitsProvider initialValue={limits} teamId={team.id}>
          <Outlet />
        </LimitsProvider>
      </TrpcProvider>
    </div>
  );
}
