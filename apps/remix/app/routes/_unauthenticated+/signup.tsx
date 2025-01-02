import { redirect } from 'react-router';

import { IS_GOOGLE_SSO_ENABLED, IS_OIDC_SSO_ENABLED } from '@documenso/lib/constants/auth';

import { SignUpForm } from '~/components/forms/signup';

import type { Route } from './+types/_unauth.signup';

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Sign Up' }];
}

export function loader() {
  // Todo
  // const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');
  const NEXT_PUBLIC_DISABLE_SIGNUP: string = 'false';

  if (NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    return redirect('/signin');
  }
}

export default function SignUp() {
  return (
    <SignUpForm
      className="w-screen max-w-screen-2xl px-4 md:px-16 lg:-my-16"
      isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED}
      isOIDCSSOEnabled={IS_OIDC_SSO_ENABLED}
    />
  );
}
