import type { Metadata } from 'next';
import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { Button } from '@documenso/ui/primitives/button';

export const metadata: Metadata = {
  title: 'Reset Password',
};

export default async function ResetPasswordPage() {
  await setupI18nSSR();

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">
          <Trans>Unable to reset password</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            The token you have used to reset your password is either expired or it never existed. If
            you have still forgotten your password, please request a new reset link.
          </Trans>
        </p>

        <Button className="mt-4" asChild>
          <Link href="/signin">
            <Trans>Return to sign in</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
