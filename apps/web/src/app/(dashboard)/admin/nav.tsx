'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { BarChart3, FileStack, Settings, Users, Wallet2 } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type AdminNavProps = HTMLAttributes<HTMLDivElement>;

export const AdminNav = ({ className, ...props }: AdminNavProps) => {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex gap-x-2.5 gap-y-2 overflow-hidden overflow-x-auto md:flex-col',
        className,
      )}
      {...props}
    >
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
          <Trans>Stats</Trans>
        </Link>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/users') && 'bg-secondary',
        )}
        asChild
      >
        <Link href="/admin/users">
          <Users className="mr-2 h-5 w-5" />
          <Trans>Users</Trans>
        </Link>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/documents') && 'bg-secondary',
        )}
        asChild
      >
        <Link href="/admin/documents">
          <FileStack className="mr-2 h-5 w-5" />
          <Trans>Documents</Trans>
        </Link>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/subscriptions') && 'bg-secondary',
        )}
        asChild
      >
        <Link href="/admin/subscriptions">
          <Wallet2 className="mr-2 h-5 w-5" />
          <Trans>Subscriptions</Trans>
        </Link>
      </Button>

      <Button
        variant="ghost"
        className={cn(
          'justify-start md:w-full',
          pathname?.startsWith('/admin/banner') && 'bg-secondary',
        )}
        asChild
      >
        <Link href="/admin/site-settings">
          <Settings className="mr-2 h-5 w-5" />
          <Trans>Site Settings</Trans>
        </Link>
      </Button>
    </div>
  );
};
