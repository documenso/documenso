import { Trans } from '@lingui/react/macro';
import { File, User2 } from 'lucide-react';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { VerifiedIcon } from '@documenso/ui/icons/verified';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type UserProfileSkeletonProps = {
  className?: string;
  user: {
    name: string;
    url: string;
  };
  rows?: number;
};

export const UserProfileSkeleton = ({ className, user, rows = 2 }: UserProfileSkeletonProps) => {
  const baseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000');

  return (
    <div
      className={cn(
        'dark:bg-background flex flex-col items-center rounded-xl bg-neutral-100 p-4',
        className,
      )}
    >
      <div className="border-border bg-background text-muted-foreground inline-block max-w-full truncate rounded-md border px-2.5 py-1.5 text-sm lowercase">
        {baseUrl.host}/u/{user.url}
      </div>

      <div className="mt-4">
        <div className="bg-primary/10 rounded-full p-1.5">
          <div className="bg-background flex h-20 w-20 items-center justify-center rounded-full border-2">
            <User2 className="h-12 w-12 text-[hsl(228,10%,90%)]" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-center gap-x-2">
          <h2 className="max-w-[12rem] truncate text-2xl font-semibold">{user.name}</h2>

          <VerifiedIcon className="text-primary h-8 w-8" />
        </div>

        <div className="dark:bg-foreground/30 mx-auto mt-4 h-2 w-52 rounded-full bg-neutral-300" />
        <div className="dark:bg-foreground/20 mx-auto mt-2 h-2 w-36 rounded-full bg-neutral-200" />
      </div>

      <div className="mt-8 w-full">
        <div className="dark:divide-foreground/30 dark:border-foreground/30 divide-y-2 divide-neutral-200 overflow-hidden rounded-lg border-2 border-neutral-200">
          <div className="text-muted-foreground dark:bg-foreground/20 bg-neutral-50 p-4 font-medium">
            Documents
          </div>

          {Array(rows)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="bg-background flex items-center justify-between gap-x-6 p-4"
              >
                <div className="flex items-center gap-x-2">
                  <File className="text-muted-foreground/80 h-8 w-8" strokeWidth={1.5} />

                  <div className="space-y-2">
                    <div className="dark:bg-foreground/30 h-1.5 w-24 rounded-full bg-neutral-300 md:w-36" />
                    <div className="dark:bg-foreground/20 h-1.5 w-16 rounded-full bg-neutral-200 md:w-24" />
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <Button type="button" size="sm" className="pointer-events-none w-32">
                    <Trans>Sign</Trans>
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
