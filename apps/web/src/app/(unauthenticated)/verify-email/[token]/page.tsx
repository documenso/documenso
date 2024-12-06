import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { AlertTriangle, XCircle, XOctagon } from 'lucide-react';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import {
  EMAIL_VERIFICATION_STATE,
  verifyEmail,
} from '@documenso/lib/server-only/user/verify-email';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

import { VerifyEmailPageClient } from './client';

export type PageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyEmailPage({ params: { token } }: PageProps) {
  await setupI18nSSR();

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

  return await match(verified)
    .with(EMAIL_VERIFICATION_STATE.NOT_FOUND, () => (
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
    ))
    .with(EMAIL_VERIFICATION_STATE.EXPIRED, () => (
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
    ))
    .with(EMAIL_VERIFICATION_STATE.VERIFIED, async () => {
      const { user } = await prisma.verificationToken.findFirstOrThrow({
        where: {
          token,
        },
        include: {
          user: true,
        },
      });

      const data = encryptSecondaryData({
        data: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
        expiresAt: DateTime.now().plus({ minutes: 5 }).toMillis(),
      });

      return <VerifyEmailPageClient signInData={data} />;
    })
    .with(EMAIL_VERIFICATION_STATE.ALREADY_VERIFIED, () => <VerifyEmailPageClient />)
    .exhaustive();
}
