'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';

import { FaXTwitter } from 'react-icons/fa6';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type TypefullyProps = HTMLAttributes<HTMLDivElement>;

export const Typefully = ({ className, ...props }: TypefullyProps) => {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Twitter Stats</h3>

      <div className="border-border mt-2.5 flex flex-1 items-center justify-center rounded-2xl border py-8 shadow-sm hover:shadow">
        <div className="flex flex-col items-center gap-y-4 text-center">
          <FaXTwitter className="h-12 w-12" />
          <Link href="https://typefully.com/documenso/stats" target="_blank">
            <h1>Documenso on X</h1>
          </Link>
          <Button className="rounded-full" size="sm" asChild>
            <Link href="https://typefully.com/documenso/stats" target="_blank">
              View all stats
            </Link>
          </Button>
          <Button className="rounded-full bg-white" size="sm" asChild>
            <Link href="https://twitter.com/documenso" target="_blank">
              Follow us on X
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
