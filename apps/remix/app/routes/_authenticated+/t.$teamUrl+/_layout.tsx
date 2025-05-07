import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Link, Outlet } from 'react-router';

import { TrpcProvider } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { useOptionalCurrentTeam } from '~/providers/team';

export default function Layout() {
  const team = useOptionalCurrentTeam();

  if (!team) {
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
    'x-team-Id': team.id.toString(),
  };

  return (
    <TrpcProvider headers={trpcHeaders}>
      <Outlet />
    </TrpcProvider>
  );
}
