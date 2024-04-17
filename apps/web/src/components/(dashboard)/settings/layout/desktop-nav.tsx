'use client';

<<<<<<< HEAD
import { HTMLAttributes } from 'react';
=======
import type { HTMLAttributes } from 'react';
>>>>>>> main

import Link from 'next/link';
import { usePathname } from 'next/navigation';

<<<<<<< HEAD
import { CreditCard, Key, User } from 'lucide-react';
=======
import { Braces, CreditCard, Lock, User, Users, Webhook } from 'lucide-react';
>>>>>>> main

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

<<<<<<< HEAD
      <Link href="/settings/password">
=======
      <Link href="/settings/teams">
>>>>>>> main
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
<<<<<<< HEAD
            pathname?.startsWith('/settings/password') && 'bg-secondary',
          )}
        >
          <Key className="mr-2 h-5 w-5" />
          Password
=======
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
>>>>>>> main
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
