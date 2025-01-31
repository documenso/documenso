import { Trans } from '@lingui/macro';
import { Link, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';
import { env } from '@documenso/lib/utils/env';

import { SignInForm } from '~/components/forms/signin';

import type { Route } from './+types/signin';

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Sign In' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);

  if (session.isAuthenticated) {
    return redirect('/documents');
  }
}

export default function SignIn() {
  const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="border-border dark:bg-background z-10 rounded-xl border bg-neutral-100 p-6">
        <h1 className="text-2xl font-semibold">
          <Trans>Sign in to your account</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Welcome back, we are lucky to have you.</Trans>
        </p>
        <hr className="-mx-6 my-4" />

        <SignInForm
          isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED}
          isOIDCSSOEnabled={IS_OIDC_SSO_ENABLED}
          oidcProviderLabel={OIDC_PROVIDER_LABEL}
        />

        {NEXT_PUBLIC_DISABLE_SIGNUP !== 'true' && (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Trans>
              Don't have an account?{' '}
              <Link to="/signup" className="text-documenso-700 duration-200 hover:opacity-70">
                Sign up
              </Link>
            </Trans>
          </p>
        )}
      </div>
    </div>
  );
}
