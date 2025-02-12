import { Trans } from '@lingui/react/macro';
import { Link, redirect } from 'react-router';

import { getResetTokenValidity } from '@documenso/lib/server-only/user/get-reset-token-validity';

import { ResetPasswordForm } from '~/components/forms/reset-password';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reset-password.$token';

export function meta() {
  return appMetaTags('Reset Password');
}

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  const isValid = await getResetTokenValidity({ token });

  if (!isValid) {
    throw redirect('/reset-password');
  }

  return {
    token,
  };
}

export default function ResetPasswordPage({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">
          <Trans>Reset Password</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Please choose your new password</Trans>
        </p>

        <ResetPasswordForm token={token} className="mt-4" />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Trans>
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary duration-200 hover:opacity-70">
              Sign up
            </Link>
          </Trans>
        </p>
      </div>
    </div>
  );
}
