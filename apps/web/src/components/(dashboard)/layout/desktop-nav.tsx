'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@documenso/ui/lib/utils';

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  const pathname = usePathname();

  return (
    <div className={cn('ml-8 hidden flex-1 gap-x-6 md:flex', className)} {...props}>
      <Link
        href="/dashboard"
        className={cn(
          'text-muted-foreground focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2',
          {
            'text-foreground': pathname?.startsWith('/dashboard'),
          },
        )}
      >
        Dashboard
      </Link>
      <Link
        href="/documents"
        className={cn(
          'text-muted-foreground focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 ',
          {
            'text-foreground': pathname?.startsWith('/documents'),
          },
        )}
      >
        Documents
      </Link>
      {/* <Link
        href="/settings/profile"
        className={cn('font-medium leading-5 text-[#A1A1AA] hover:opacity-80', {
          'text-primary-foreground': pathname?.startsWith('/settings'),
        })}
      >
        Settings
      </Link> */}
    </div>
  );
};
