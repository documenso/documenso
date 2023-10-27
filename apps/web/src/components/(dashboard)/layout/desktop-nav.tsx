'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@documenso/ui/lib/utils';

const navigationLinks = [
  {
    href: '/documents',
    label: 'Documents',
  },
  {
    href: '/templates',
    label: 'Templates',
  },
];

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  const pathname = usePathname();

  return (
    <div className={cn('ml-8 hidden flex-1 gap-x-6 md:flex', className)} {...props}>
      {/* We do now :) */}
      {navigationLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'text-muted-foreground dark:text-muted focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2',
            {
              'text-foreground dark:text-muted-foreground': pathname?.startsWith(href),
            },
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
};
