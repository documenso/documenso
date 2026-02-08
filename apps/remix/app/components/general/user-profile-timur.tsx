import { Trans } from '@lingui/react/macro';
import { File } from 'lucide-react';

import timurImage from '@documenso/assets/images/timur.png';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { VerifiedIcon } from '@documenso/ui/icons/verified';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type UserProfileTimurProps = {
  className?: string;
  rows?: number;
};

export const UserProfileTimur = ({ className, rows = 2 }: UserProfileTimurProps) => {
  const baseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000');

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl bg-neutral-100 p-4 dark:bg-background',
        className,
      )}
    >
      <div className="inline-block max-w-full truncate rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground">
        {baseUrl.host}/u/timur
      </div>

      <div className="mt-4">
        <img src={timurImage} className="h-20 w-20 rounded-full" alt="image of timur ercan" />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-center gap-x-2">
          <h2 className="text-2xl font-semibold">Timur Ercan</h2>

          <VerifiedIcon className="h-8 w-8 text-primary" />
        </div>

        <p className="mt-4 max-w-[40ch] text-center text-sm text-muted-foreground">
          <Trans>Hey I’m Timur</Trans>
        </p>

        <p className="mt-1 max-w-[40ch] text-center text-sm text-muted-foreground">
          <Trans>Pick any of the following agreements below and start signing to get started</Trans>
        </p>
      </div>

      <div className="mt-8 w-full">
        <div className="divide-y-2 divide-neutral-200 overflow-hidden rounded-lg border-2 border-neutral-200 dark:divide-foreground/30 dark:border-foreground/30">
          <div className="bg-neutral-50 p-4 font-medium text-muted-foreground dark:bg-foreground/20">
            <Trans>Documents</Trans>
          </div>

          {Array(rows)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-x-6 bg-background p-4"
              >
                <div className="flex items-center gap-x-2">
                  <File className="h-8 w-8 text-muted-foreground/80" strokeWidth={1.5} />

                  <div className="space-y-2">
                    <div className="h-1.5 w-24 rounded-full bg-neutral-300 md:w-36 dark:bg-foreground/30" />
                    <div className="h-1.5 w-16 rounded-full bg-neutral-200 md:w-24 dark:bg-foreground/20" />
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
