'use client';

import { HTMLAttributes } from 'react';

import { cn } from '@documenso/ui/lib/utils';

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  // const pathname = usePathname();

  return (
    <div className={cn('ml-8 hidden flex-1 gap-x-6 md:flex', className)} {...props}>
      {/* We have no other subpaths rn */}
      {/* <Link
        href="/documents"
        className={cn(
          'text-muted-foreground focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2',
          {
            'text-foreground': pathname?.startsWith('/documents'),
          },
        )}
      >
        Documents
      </Link> */}
    </div>
  );
};
