'use client';

import { useEffect } from 'react';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { CheckCircle2 } from 'lucide-react';
import { signIn } from 'next-auth/react';

import { Button } from '@documenso/ui/primitives/button';

export type VerifyEmailPageClientProps = {
  signInData?: string;
};

export const VerifyEmailPageClient = ({ signInData }: VerifyEmailPageClientProps) => {
  useEffect(() => {
    if (signInData) {
      void signIn('manual', {
        credential: signInData,
        callbackUrl: '/documents',
      });
    }
  }, [signInData]);

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

          {!signInData && (
            <Button className="mt-4" asChild>
              <Link href="/">
                <Trans>Go back home</Trans>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
