import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getResetTokenValidity } from '@documenso/lib/server-only/user/get-reset-token-validity';

import { ResetPasswordForm } from '~/components/forms/reset-password';

type ResetPasswordPageProps = {
  params: {
    token: string;
  };
};

export default async function ResetPasswordPage({ params: { token } }: ResetPasswordPageProps) {
  await setupI18nSSR();

  const isValid = await getResetTokenValidity({ token });

  if (!isValid) {
    redirect('/reset-password');
  }

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
            <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
              Sign up
            </Link>
          </Trans>
        </p>
      </div>
    </div>
  );
}
