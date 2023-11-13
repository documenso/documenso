'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { CreditCard, Key, User } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type MobileNavProps = HTMLAttributes<HTMLDivElement> & {
  isTwoFactorAuthEnabled: boolean;
};
export const MobileNav = ({ className, isTwoFactorAuthEnabled, ...props }: MobileNavProps) => {
  const pathname = usePathname();
  const locale = useParams()?.locale as LocaleTypes;

  const { getFlag } = useFeatureFlags();

  const isBillingEnabled = getFlag('app_billing');

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
      <Link href={`/${locale}/settings/profile`}>
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

      <Link href={`/${locale}/settings/password`}>
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
      {isTwoFactorAuthEnabled && (
        <Link href={`/${locale}/settings/two-factor-auth`}>
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith('/settings/two-factor-auth') && 'bg-secondary',
            )}
          >
            <Key className="mr-2 h-5 w-5" />
            Two factor auth
          </Button>
        </Link>
      )}
      {isBillingEnabled && (
        <Link href={`/${locale}/settings/billing`}>
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
