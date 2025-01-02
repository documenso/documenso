import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronLeft } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse, redirect, useNavigate } from 'react-router';
import { getLoaderSession } from 'server/utils/get-loader-session';
import { match } from 'ts-pattern';

import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { TrpcProvider } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

import { TeamProvider } from '~/providers/team';

import type { Route } from './+types/_layout';

export const loader = () => {
  const { currentTeam } = getLoaderSession();

  if (!currentTeam) {
    throw redirect('/settings/teams');
  }

  const trpcHeaders = {
    'x-team-Id': currentTeam.id.toString(),
  };

  return {
    currentTeam,
    trpcHeaders,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { currentTeam, trpcHeaders } = loaderData;

  return (
    <TeamProvider team={currentTeam}>
      <TrpcProvider headers={trpcHeaders}>
        <main className="mt-8 pb-8 md:mt-12 md:pb-12">
          <Outlet />
        </main>
      </TrpcProvider>
    </TeamProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { _ } = useLingui();

  const navigate = useNavigate();

  let errorMessage = msg`Unknown error`;
  let errorDetails: MessageDescriptor | null = null;

  if (error instanceof Error && error.message === AppErrorCode.UNAUTHORIZED) {
    errorMessage = msg`Unauthorized`;
    errorDetails = msg`You are not authorized to view this page.`;
  }

  if (isRouteErrorResponse(error)) {
    return match(error.status)
      .with(404, () => (
        <div className="mx-auto flex min-h-[80vh] w-full items-center justify-center py-32">
          <div>
            <p className="text-muted-foreground font-semibold">
              <Trans>404 Team not found</Trans>
            </p>

            <h1 className="mt-3 text-2xl font-bold md:text-3xl">
              <Trans>Oops! Something went wrong.</Trans>
            </h1>

            <p className="text-muted-foreground mt-4 text-sm">
              <Trans>
                The team you are looking for may have been removed, renamed or may have never
                existed.
              </Trans>
            </p>

            <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
              <Button asChild className="w-32">
                <Link to="/settings/teams">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  <Trans>Go Back</Trans>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ))
      .with(500, () => (
        <div className="mx-auto flex min-h-[80vh] w-full items-center justify-center py-32">
          <div>
            <p className="text-muted-foreground font-semibold">{_(errorMessage)}</p>

            <h1 className="mt-3 text-2xl font-bold md:text-3xl">
              <Trans>Oops! Something went wrong.</Trans>
            </h1>

            <p className="text-muted-foreground mt-4 text-sm">
              {errorDetails ? _(errorDetails) : ''}
            </p>

            <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
              <Button
                variant="ghost"
                className="w-32"
                onClick={() => {
                  void navigate(-1);
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <Trans>Go Back</Trans>
              </Button>

              <Button asChild>
                <Link to="/settings/teams">
                  <Trans>View teams</Trans>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ))
      .otherwise(() => (
        <>
          <h1>
            {error.status} {error.statusText}
          </h1>
          <p>{error.data}</p>
        </>
      ));
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
