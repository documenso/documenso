import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  isSignupEnabledForProvider,
} from '@documenso/lib/constants/auth';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';
import { msg } from '@lingui/core/macro';
import { redirect } from 'react-router';

import { SignUpForm } from '~/components/forms/signup';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signup';

export function meta() {
  return appMetaTags(msg`Sign Up`);
}

export function loader({ request }: Route.LoaderArgs) {
  const isEmailPasswordSignupEnabled = isSignupEnabledForProvider('email');
  const isGoogleSignupEnabled = IS_GOOGLE_SSO_ENABLED && isSignupEnabledForProvider('google');
  const isMicrosoftSignupEnabled = IS_MICROSOFT_SSO_ENABLED && isSignupEnabledForProvider('microsoft');
  const isOidcSignupEnabled = IS_OIDC_SSO_ENABLED && isSignupEnabledForProvider('oidc');

  const isAnySignupEnabled =
    isEmailPasswordSignupEnabled || isGoogleSignupEnabled || isMicrosoftSignupEnabled || isOidcSignupEnabled;

  if (!isAnySignupEnabled) {
    throw redirect('/signin');
  }

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  return {
    isEmailPasswordSignupEnabled,
    isGoogleSignupEnabled,
    termsUrl: process.env.NEXT_PUBLIC_TERMS_URL || 'https://documenso.com/terms',
    privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL || 'https://documenso.com/privacy',
    isMicrosoftSignupEnabled,
    isOidcSignupEnabled,
    returnTo,
  };
}

export default function SignUp({ loaderData }: Route.ComponentProps) {
  const {
    isEmailPasswordSignupEnabled,
    isGoogleSignupEnabled,
    isMicrosoftSignupEnabled,
    isOidcSignupEnabled,
    returnTo,
    termsUrl,
    privacyUrl,
  } = loaderData;

  return (
    <SignUpForm
      className="w-screen max-w-screen-2xl px-4 md:px-16 lg:-my-16"
      isEmailPasswordSignupEnabled={isEmailPasswordSignupEnabled}
      isGoogleSignupEnabled={isGoogleSignupEnabled}
      isMicrosoftSignupEnabled={isMicrosoftSignupEnabled}
      isOidcSignupEnabled={isOidcSignupEnabled}
      returnTo={returnTo}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
    />
  );
}
