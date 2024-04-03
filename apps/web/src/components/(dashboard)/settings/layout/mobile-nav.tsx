'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Braces, CreditCard, Lock, User, Users, Webhook } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type MobileNavProps = HTMLAttributes<HTMLDivElement>;

export const MobileNav = ({ className, ...props }: MobileNavProps) => {
  const pathname = usePathname();

  const { getFlag } = useFeatureFlags();

  const isBillingEnabled = getFlag('app_billing');

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

      <Link href="/settings/tokens">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/tokens') && 'bg-secondary',
          )}
        >
          <Braces className="mr-2 h-5 w-5" />
          API Tokens
        </Button>
      </Link>

      <Link href="/settings/webhooks">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/webhooks') && 'bg-secondary',
          )}
        >
          <Webhook className="mr-2 h-5 w-5" />
          Webhooks
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
