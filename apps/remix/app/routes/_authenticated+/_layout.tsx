import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Link, Outlet, redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { OrganisationProvider } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { AppBanner } from '~/components/general/app-banner';
import { Header } from '~/components/general/app-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { OrganisationBillingBanner } from '~/components/general/organisations/organisation-billing-banner';
import { VerifyEmailBanner } from '~/components/general/verify-email-banner';
import { TeamProvider } from '~/providers/team';

import type { Route } from './+types/_layout';

/**
 * Don't revalidate (run the loader on sequential navigations)
 *
 * Update values via providers.
 */
export const shouldRevalidate = () => false;

export async function loader({ request }: Route.LoaderArgs) {
  const [session, banner] = await Promise.all([
    getOptionalSession(request),
    getSiteSettings().then((settings) =>
      settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
    ),
  ]);

  if (!session.isAuthenticated) {
    throw redirect('/signin');
  }

  return {
    banner,
  };
}

export default function Layout({ loaderData, params, matches }: Route.ComponentProps) {
  const { banner } = loaderData;

  const { user, organisations } = useSession();

  const teamUrl = params.teamUrl;
  const orgUrl = params.orgUrl;

  const teams = organisations.flatMap((org) => org.teams);

  const extractCurrentOrganisation = () => {
    if (orgUrl) {
      return organisations.find((org) => org.url === orgUrl);
    }

    // Search organisations to find the team since we don't have access to the orgUrl in the URL.
    if (teamUrl) {
      return organisations.find((org) => org.teams.some((team) => team.url === teamUrl));
    }

    return null;
  };

  const currentTeam = teams.find((team) => team.url === teamUrl);
  const currentOrganisation = extractCurrentOrganisation() || null;

  const orgNotFound = params.orgUrl && !currentOrganisation;
  const teamNotFound = params.teamUrl && !currentTeam;

  // Hide the header for editor routes.
  const hideHeader = matches.some(
    (match) =>
      match?.id === 'routes/_authenticated+/t.$teamUrl+/documents.$id.edit' ||
      match?.id === 'routes/_authenticated+/t.$teamUrl+/templates.$id.edit',
  );

  if (orgNotFound || teamNotFound) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: orgNotFound
            ? {
                heading: msg`Organisation not found`,
                subHeading: msg`404 Organisation not found`,
                message: msg`The organisation you are looking for may have been removed, renamed or may have never existed.`,
              }
            : {
                heading: msg`Team not found`,
                subHeading: msg`404 Team not found`,
                message: msg`The team you are looking for may have been removed, renamed or may have never existed.`,
              },
        }}
        primaryButton={
          <Button asChild>
            <Link to="/">
              <Trans>Go home</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <OrganisationProvider organisation={currentOrganisation}>
      <TeamProvider team={currentTeam || null}>
        <OrganisationBillingBanner />

        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        {banner && !hideHeader && <AppBanner banner={banner} />}

        {!hideHeader && <Header />}

        <main
          className={cn({
            'mt-8 pb-8 md:mt-12 md:pb-12': !hideHeader,
          })}
        >
          <Outlet />
        </main>
      </TeamProvider>
    </OrganisationProvider>
  );
}
