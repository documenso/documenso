'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BarChart3, User2 } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type AdminNavProps = HTMLAttributes<HTMLDivElement>;

export const AdminNav = ({ className, ...props }: AdminNavProps) => {
  const pathname = usePathname();

  return (
    <div className={cn('flex gap-x-2.5 gap-y-2 md:flex-col', className)} {...props}>
      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/stats') && 'bg-secondary',
        )}
        asChild
      >
        <Link href="/admin/stats">
          <BarChart3 className="mr-2 h-5 w-5" />
          Stats
        </Link>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/users') && 'bg-secondary',
        )}
        disabled
      >
        <User2 className="mr-2 h-5 w-5" />
        Users (Coming Soon)
      </Button>
    </div>
  );
};
