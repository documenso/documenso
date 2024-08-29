'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { ChevronLeft } from 'lucide-react';

import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { Button } from '@documenso/ui/primitives/button';

type ErrorProps = {
  error: Error & { digest?: string };
};

export default function ErrorPage({ error }: ErrorProps) {
  const { _ } = useLingui();

  const router = useRouter();

  let errorMessage = msg`Unknown error`;
  let errorDetails: MessageDescriptor | null = null;

  if (error.message === AppErrorCode.UNAUTHORIZED) {
    errorMessage = msg`Unauthorized`;
    errorDetails = msg`You are not authorized to view this page.`;
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full items-center justify-center py-32">
      <div>
        <p className="text-muted-foreground font-semibold">{_(errorMessage)}</p>

        <h1 className="mt-3 text-2xl font-bold md:text-3xl">
          <Trans>Oops! Something went wrong.</Trans>
        </h1>

        <p className="text-muted-foreground mt-4 text-sm">{errorDetails ? _(errorDetails) : ''}</p>

        <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
          <Button
            variant="ghost"
            className="w-32"
            onClick={() => {
              void router.back();
            }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <Trans>Go Back</Trans>
          </Button>

          <Button asChild>
            <Link href="/settings/teams">
              <Trans>View teams</Trans>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
