import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';

import { SignInForm } from '~/components/forms/signin';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags(msg`Sign In`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  return { returnTo };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { returnTo } = loaderData;

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

        <SignInForm returnTo={returnTo} />
      </div>
    </div>
  );
}
