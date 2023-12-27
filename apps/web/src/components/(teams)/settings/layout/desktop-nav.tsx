'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { CreditCard, Key, User } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  const pathname = usePathname();
  const params = useParams();

  const { getFlag } = useFeatureFlags();

  const isBillingEnabled = getFlag('app_billing');

  const teamUrl = typeof params?.teamUrl === 'string' ? params?.teamUrl : '';

  return (
    <div className={cn('flex flex-col gap-y-2', className)} {...props}>
      <Link href={`/t/${teamUrl}/settings`}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname === `/t/${teamUrl}/settings` && 'bg-secondary',
          )}
        >
          <User className="mr-2 h-5 w-5" />
          General
        </Button>
      </Link>

      <Link href={`/t/${teamUrl}/settings/members`}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(`/t/${teamUrl}/settings/members`) && 'bg-secondary',
          )}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          Members
        </Button>
      </Link>

      {isBillingEnabled && (
        <Link href={`/t/${teamUrl}/settings/billing`}>
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith(`/t/${teamUrl}/settings/billing`) && 'bg-secondary',
            )}
          >
            <Key className="mr-2 h-5 w-5" />
            Billing
          </Button>
        </Link>
      )}
    </div>
  );
};
