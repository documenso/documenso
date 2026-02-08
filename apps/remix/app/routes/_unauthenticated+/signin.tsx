import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Link, redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';
import { env } from '@documenso/lib/utils/env';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';

import { SignInForm } from '~/components/forms/signin';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  // SSR env variables.
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED;
  const isMicrosoftSSOEnabled = IS_MICROSOFT_SSO_ENABLED;
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED;
  const oidcProviderLabel = OIDC_PROVIDER_LABEL;

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  return {
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
    returnTo,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const {
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
    returnTo,
  } = loaderData;

  const [isEmbeddedRedirect, setIsEmbeddedRedirect] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    const params = new URLSearchParams(hash);

    setIsEmbeddedRedirect(params.get('embedded') === 'true');
  }, []);

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
        <h1 className="text-2xl font-semibold">
          <Trans>Sign in to your account</Trans>
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          <Trans>Welcome back, we are lucky to have you.</Trans>
        </p>
        <hr className="-mx-6 my-4" />

        <SignInForm
          isGoogleSSOEnabled={isGoogleSSOEnabled}
          isMicrosoftSSOEnabled={isMicrosoftSSOEnabled}
          isOIDCSSOEnabled={isOIDCSSOEnabled}
          oidcProviderLabel={oidcProviderLabel}
          returnTo={returnTo}
        />

        {!isEmbeddedRedirect && env('NEXT_PUBLIC_DISABLE_SIGNUP') !== 'true' && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Trans>
              Don't have an account?{' '}
              <Link
                to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}
                className="text-brand-700 duration-200 hover:opacity-70"
              >
                Sign up
              </Link>
            </Trans>
          </p>
        )}
      </div>
    </div>
  );
}
