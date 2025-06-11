import { Trans } from '@lingui/react/macro';
import { ChevronLeft, Loader } from 'lucide-react';
import { Link } from 'react-router';

import { Skeleton } from '@documenso/ui/primitives/skeleton';

export default function DocumentEditSkeleton() {
  return (
    <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
      <Link to="/" className="flex grow-0 items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Documents</Trans>
      </Link>

      <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
        <Trans>Loading Document...</Trans>
      </h1>

      <div className="flex h-10 items-center">
        <Skeleton className="my-6 h-4 w-24 rounded-2xl" />
      </div>

      <div className="mt-4 grid h-[80vh] max-h-[60rem] w-full grid-cols-12 gap-x-8">
        <div className="dark:bg-background border-border col-span-12 rounded-xl border-2 bg-white/50 p-2 before:rounded-xl lg:col-span-6 xl:col-span-7">
          <div className="flex h-[80vh] max-h-[60rem] flex-col items-center justify-center">
            <Loader className="text-documenso h-12 w-12 animate-spin" />

            <p className="text-muted-foreground mt-4">
              <Trans>Loading document...</Trans>
            </p>
          </div>
        </div>

        <div className="bg-background border-border col-span-12 rounded-xl border-2 before:rounded-xl lg:col-span-6 xl:col-span-5" />
      </div>
    </div>
  );
}
