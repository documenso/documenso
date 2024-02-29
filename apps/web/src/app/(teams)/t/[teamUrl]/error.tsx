'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ChevronLeft } from 'lucide-react';

import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { Button } from '@documenso/ui/primitives/button';

type ErrorProps = {
  error: Error & { digest?: string };
};

export default function ErrorPage({ error }: ErrorProps) {
  const router = useRouter();

  let errorMessage = 'Unknown error';
  let errorDetails = '';

  if (error.message === AppErrorCode.UNAUTHORIZED) {
    errorMessage = 'Unauthorized';
    errorDetails = 'You are not authorized to view this page.';
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full items-center justify-center py-32">
      <div>
        <p className="text-muted-foreground font-semibold">{errorMessage}</p>

        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Oops! Something went wrong.</h1>

        <p className="text-muted-foreground mt-4 text-sm">{errorDetails}</p>

        <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
          <Button
            variant="ghost"
            className="w-32"
            onClick={() => {
              void router.back();
            }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Button asChild>
            <Link href="/settings/teams">View teams</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
