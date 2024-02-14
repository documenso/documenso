'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CreditCard, Lock, User, Users } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type MobileNavProps = HTMLAttributes<HTMLDivElement>;

export const MobileNav = ({ className, ...props }: MobileNavProps) => {
  const pathname = usePathname();

  const { getFlag } = useFeatureFlags();

  const isBillingEnabled = getFlag('app_billing');
  const isTeamsEnabled = getFlag('app_teams');

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
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

      {isTeamsEnabled && (
        <Link href="/settings/teams">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith('/settings/teams') && 'bg-secondary',
            )}
          >
            <Users className="mr-2 h-5 w-5" />
            Teams
          </Button>
        </Link>
      )}

      <Link href="/settings/security">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/security') && 'bg-secondary',
          )}
        >
          <Lock className="mr-2 h-5 w-5" />
          Security
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
