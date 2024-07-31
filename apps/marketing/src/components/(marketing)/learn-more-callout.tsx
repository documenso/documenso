'use client';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { usePlausible } from 'next-plausible';
import { LuBookOpen } from 'react-icons/lu';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type CalloutProps = {
  className?: string;
  [key: string]: unknown;
};

export const LearnMoreCallout = ({ className }: CalloutProps) => {
  const event = usePlausible();

  return (
    <div
      className={cn('mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4', className)}
    >
      <Link href="https://documen.so/sales">
        <Button
          type="button"
          variant="outline"
          className="rounded-full bg-transparent backdrop-blur-sm"
        >
          <Trans>Questions?</Trans>
          <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs font-medium">
            <Trans>Book a Sales Call</Trans>
          </span>
        </Button>
      </Link>

      <Link
        target="_blank"
        href="https://docs.documenso.com/users/get-started/account-creation?utm_source=learn-more-callout"
        onClick={() => event('view-github')}
      >
        <Button variant="outline" className="rounded-full bg-transparent backdrop-blur-sm">
          <LuBookOpen className="mr-2 inline h-5 w-5" />
          <Trans>Learn More</Trans>
        </Button>
      </Link>
    </div>
  );
};
