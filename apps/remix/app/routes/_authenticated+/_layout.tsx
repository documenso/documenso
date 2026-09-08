import { authClient } from '@documenso/auth/client';
import { useChildRouteFlags } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { OrganisationProvider } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';
import { calculateTwoFactorDeadlineTimerDelay } from '@documenso/lib/utils/two-factor';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';

import { AppBanner } from '~/components/general/app-banner';
import { Header } from '~/components/general/app-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { OrganisationBillingBanner } from '~/components/general/organisations/organisation-billing-banner';
import { OrganisationQuotaBanner } from '~/components/general/organisations/organisation-quota-banner';
import { TwoFactorGraceBanner } from '~/components/general/two-factor-grace-banner';
import { VerifyEmailBanner } from '~/components/general/verify-email-banner';
import { authenticatedMiddleware } from '~/middleware/authenticated';
import { twoFactorEnforcementMiddleware } from '~/middleware/two-factor-enforcement';
import { TeamProvider } from '~/providers/team';
import { buildTwoFactorOnboardingPath } from '~/utils/two-factor-onboarding-path';

import type { Route } from './+types/_layout';

/**
 * Don't revalidate (run the loader on sequential navigations)
 *
 * Update values via providers.
 *
 * The auth gate and the instance 2FA enforcement redirect live in middleware
 * (not this loader), so they still run on every child loader fetch.
 */
export const shouldRevalidate = () => false;

export const middleware = [authenticatedMiddleware, twoFactorEnforcementMiddleware];

export async function loader() {
  const banner = await getSiteSettings().then((settings) =>
    settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
  );

  return {
    banner,
  };
}

export default function Layout({ loaderData, params, matches }: Route.ComponentProps) {
  const { banner } = loaderData;

  const { user, session, organisations, twoFactorEnforcement } = useSession();

  const location = useLocation();
  const navigate = useNavigate();

  // Client-side counterpart of `twoFactorEnforcementMiddleware`: a grace
  // deadline can pass while the app is open without any server round trip. The session provider refreshes
  // the enforcement status on navigation/focus; the timer covers a deadline
  // crossing while the tab sits idle.
  const isInstanceTwoFactorBlocked = twoFactorEnforcement.required && twoFactorEnforcement.isBlocked;

  useEffect(() => {
    if (!twoFactorEnforcement.required || twoFactorEnforcement.isSatisfied) {
      return;
    }

    const redirectToOnboarding = () => {
      void navigate(buildTwoFactorOnboardingPath(`${location.pathname}${location.search}`));
    };

    if (twoFactorEnforcement.isBlocked) {
      redirectToOnboarding();

      return;
    }

    // Within grace: fire at the deadline instant. A `null` delay means the
    // deadline is beyond `setTimeout` range (~24.8 days) — no timer needed,
    // the status is re-evaluated long before then.
    const timerDelay = calculateTwoFactorDeadlineTimerDelay({
      deadline: twoFactorEnforcement.deadline,
      now: new Date(),
    });

    if (timerDelay === null) {
      return;
    }

    const timeout = window.setTimeout(redirectToOnboarding, timerDelay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [twoFactorEnforcement, location.pathname, location.search, navigate]);

  const { layoutMode } = useChildRouteFlags();

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

  // Per-organisation 2FA enforcement: when the current org/team context's
  // organisation blocks the user, render a 403 screen (NOT a redirect — the
  // rest of the app stays usable) linking to the enrolment page. Derived
  // client-side from the session provider's bootstrap payload, which stays
  // readable while blocked. This is UX only — the security boundary is the
  // tRPC/Hono asserts.
  const isCurrentOrganisationTwoFactorBlocked =
    Boolean(orgUrl || teamUrl) &&
    Boolean(currentOrganisation?.twoFactorEnforcement.required && currentOrganisation.twoFactorEnforcement.isBlocked);

  // State (b): enrolled, but this session never passed a second factor —
  // enrolment would rightly refuse, so the remediation is a fresh sign-in.
  const requiresRelogin = user.twoFactorEnabled && !session.twoFactorVerified;

  // Instance enforcement takes precedence over the org 403 below: render
  // nothing while the effect above navigates to forced enrolment.
  if (isInstanceTwoFactorBlocked) {
    return null;
  }

  if (isCurrentOrganisationTwoFactorBlocked) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

    return (
      <GenericErrorLayout
        errorCode={403}
        errorCodeMap={{
          403: {
            heading: msg`Two-factor authentication required`,
            subHeading: msg`403 Forbidden`,
            message: requiresRelogin
              ? msg`This organisation requires two-factor authentication. Two-factor authentication is enabled for your account, but this session has not been verified with a second factor. Sign out and log back in to verify this session.`
              : msg`This organisation requires two-factor authentication. Enable it for your account to regain access. The rest of your account remains available.`,
          },
        }}
        primaryButton={
          requiresRelogin ? (
            <Button onClick={() => void authClient.signOut()}>
              <Trans>Sign out</Trans>
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/onboarding/2fa?returnTo=${returnTo}`}>
                <Trans>Set up two-factor authentication</Trans>
              </Link>
            </Button>
          )
        }
        secondaryButton={
          <Button variant="ghost" asChild>
            <Link to="/">
              <Trans>Go home</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

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
        <div className={cn({ 'md:flex md:h-dvh md:flex-col md:overflow-hidden': layoutMode === 'settings' })}>
          <TwoFactorGraceBanner />

          <OrganisationBillingBanner />

          <OrganisationQuotaBanner />

          {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

          {banner && !hideHeader && <AppBanner banner={banner} />}

          {!hideHeader && <Header fullWidth={layoutMode === 'settings'} />}

          <main
            className={cn({
              'mt-8 pb-8 md:mt-12 md:pb-12': !hideHeader && layoutMode !== 'settings',
              'md:flex md:min-h-0 md:flex-1 md:flex-col': layoutMode === 'settings',
            })}
          >
            <Outlet />
          </main>
        </div>
      </TeamProvider>
    </OrganisationProvider>
  );
}
