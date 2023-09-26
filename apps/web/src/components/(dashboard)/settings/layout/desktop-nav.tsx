'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CreditCard, Key, User } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  const pathname = usePathname();

  const { getFlag } = useFeatureFlags();

  const isBillingEnabled = getFlag('app_billing');

  return (
    <div className={cn('flex flex-col gap-y-2', className)} {...props}>
      <Link href="/settings/profile">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/profile') && 'bg-secondary',
          )}
        >
          <User className="mr-2 h-5 w-5" />
          Profile
        </Button>
      </Link>

      <Link href="/settings/password">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/password') && 'bg-secondary',
          )}
        >
          <Key className="mr-2 h-5 w-5" />
          Password
        </Button>
      </Link>

      {isBillingEnabled && (
        <Link href="/settings/billing">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith('/settings/billing') && 'bg-secondary',
            )}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Billing
          </Button>
        </Link>
      )}
    </div>
  );
};
