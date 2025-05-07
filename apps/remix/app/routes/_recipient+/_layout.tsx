import { Trans } from '@lingui/react/macro';
import { ChevronLeft } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse } from 'react-router';

import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { Button } from '@documenso/ui/primitives/button';

import { Header as AuthenticatedHeader } from '~/components/general/app-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';

import type { Route } from './+types/_layout';

/**
 * A layout to handle scenarios where the user is a recipient of a given resource
 * where we do not care whether they are authenticated or not.
 *
 * Such as direct template access, or signing.
 */
export default function RecipientLayout() {
  const { sessionData } = useOptionalSession();

  return (
    <div className="min-h-screen">
      {sessionData?.user && <AuthenticatedHeader />}

      <main className="mb-8 mt-8 px-4 md:mb-12 md:mt-12 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <GenericErrorLayout
      errorCode={errorCode}
      secondaryButton={null}
      primaryButton={
        <Button asChild className="w-32">
          <Link to="/">
            <ChevronLeft className="mr-2 h-4 w-4" />
            <Trans>Go Back</Trans>
          </Link>
        </Button>
      }
    />
  );
}
