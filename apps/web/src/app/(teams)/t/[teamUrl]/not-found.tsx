'use client';

import Link from 'next/link';

import { ChevronLeft } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full items-center justify-center py-32">
      <div>
        <p className="text-muted-foreground font-semibold">404 Team not found</p>

        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Oops! Something went wrong.</h1>

        <p className="text-muted-foreground mt-4 text-sm">
          The team you are looking for may have been removed, renamed or may have never existed.
        </p>

        <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
          <Button asChild className="w-32">
            <Link href="/settings/teams">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
