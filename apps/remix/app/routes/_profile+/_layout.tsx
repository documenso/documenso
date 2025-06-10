import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { PlusIcon } from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse } from 'react-router';

import LogoIcon from '@documenso/assets/logo_icon.png';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { Header as AuthenticatedHeader } from '~/components/general/app-header';
import { BrandingLogo } from '~/components/general/branding-logo';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/_layout';

export function meta() {
  return appMetaTags('Profile');
}

export default function PublicProfileLayout() {
  const { sessionData } = useOptionalSession();

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      {sessionData ? (
        <AuthenticatedHeader />
      ) : (
        <header
          className={cn(
            'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
            scrollY > 5 && 'border-b-border',
          )}
        >
          <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:px-8">
            <Link
              to="/"
              className="focus-visible:ring-ring ring-offset-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:inline"
            >
              <BrandingLogo className="hidden h-6 w-auto sm:block" />

              <img
                src={LogoIcon}
                alt="Documenso Logo"
                width={48}
                height={48}
                className="h-10 w-auto sm:hidden dark:invert"
              />
            </Link>

            <div className="flex flex-row items-center justify-center">
              <p className="text-muted-foreground mr-4">
                <span className="text-sm sm:hidden">
                  <Trans>Want your own public profile?</Trans>
                </span>
                <span className="hidden text-sm sm:block">
                  <Trans>Like to have your own public profile with agreements?</Trans>
                </span>
              </p>

              <Button asChild variant="secondary">
                <Link to="/signup">
                  <div className="hidden flex-row items-center sm:flex">
                    <PlusIcon className="mr-1 h-5 w-5" />
                    <Trans>Create now</Trans>
                  </div>

                  <span className="sm:hidden">
                    <Trans>Create</Trans>
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className="my-8 px-4 md:my-12 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  const errorCodeMap = {
    404: {
      subHeading: msg`404 Profile not found`,
      heading: msg`Oops! Something went wrong.`,
      message: msg`The profile you are looking for could not be found.`,
    },
  };

  return (
    <GenericErrorLayout
      errorCode={errorCode}
      errorCodeMap={errorCodeMap}
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
