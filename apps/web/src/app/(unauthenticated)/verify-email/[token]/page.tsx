import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { AlertTriangle, CheckCircle2, XCircle, XOctagon } from 'lucide-react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';
import { Button } from '@documenso/ui/primitives/button';

export type PageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyEmailPage({ params: { token } }: PageProps) {
  setupI18nSSR();

  if (!token) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <div className="mb-4 text-red-300">
            <XOctagon />
          </div>

          <h2 className="text-4xl font-semibold">
            <Trans>No token provided</Trans>
          </h2>
          <p className="text-muted-foreground mt-2 text-base">
            <Trans>
              It seems that there is no token provided. Please check your email and try again.
            </Trans>
          </p>
        </div>
      </div>
    );
  }

  const verified = await verifyEmail({ token });

  if (verified === null) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <AlertTriangle className="h-10 w-10 text-yellow-500" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">
              <Trans>Something went wrong</Trans>
            </h2>

            <p className="text-muted-foreground mt-4">
              <Trans>
                We were unable to verify your email. If your email is not verified already, please
                try again.
              </Trans>
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">
                <Trans>Go back home</Trans>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">
              <Trans>Your token has expired!</Trans>
            </h2>

            <p className="text-muted-foreground mt-4">
              <Trans>
                It seems that the provided token has expired. We've just sent you another token,
                please check your email and try again.
              </Trans>
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">
                <Trans>Go back home</Trans>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">
            <Trans>Email Confirmed!</Trans>
          </h2>

          <p className="text-muted-foreground mt-4">
            <Trans>
              Your email has been successfully confirmed! You can now use all features of Documenso.
            </Trans>
          </p>

          <Button className="mt-4" asChild>
            <Link href="/">
              <Trans>Go back home</Trans>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
