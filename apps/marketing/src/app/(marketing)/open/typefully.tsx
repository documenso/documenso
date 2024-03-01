'use client';

import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import Twitter from '@documenso/assets/twitter-icon.png';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type TypefullyProps = HTMLAttributes<HTMLDivElement>;

export const Typefully = ({ className, ...props }: TypefullyProps) => {
  const [isSSR, setIsSSR] = useState(true);

  useEffect(() => {
    setIsSSR(false);
  }, []);
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Twitter Stats</h3>

      <div className="border-border mt-2.5 flex flex-1 items-center justify-center rounded-2xl border shadow-sm hover:shadow">
        {!isSSR && (
          <div className="flex flex-col gap-y-4 text-center">
            <Image className="opacity-75" src={Twitter} alt="Twitter Logo" width={120} />
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
        )}
      </div>
    </div>
  );
};
