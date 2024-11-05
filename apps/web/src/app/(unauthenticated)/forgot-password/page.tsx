import type { Metadata } from 'next';
import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { ForgotPasswordForm } from '~/components/forms/forgot-password';

export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default async function ForgotPasswordPage() {
  await setupI18nSSR();

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">
          <Trans>Forgot your password?</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            No worries, it happens! Enter your email and we'll email you a special link to reset
            your password.
          </Trans>
        </p>

        <ForgotPasswordForm className="mt-4" />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Trans>
            Remembered your password?{' '}
            <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
              Sign In
            </Link>
          </Trans>
        </p>
      </div>
    </div>
  );
}
