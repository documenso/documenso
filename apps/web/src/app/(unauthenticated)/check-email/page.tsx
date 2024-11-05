import type { Metadata } from 'next';
import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { Button } from '@documenso/ui/primitives/button';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default async function ForgotPasswordPage() {
  await setupI18nSSR();

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">
          <Trans>Email sent!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            A password reset email has been sent, if you have an account you should see it in your
            inbox shortly.
          </Trans>
        </p>

        <Button asChild>
          <Link href="/signin">
            <Trans>Return to sign in</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
