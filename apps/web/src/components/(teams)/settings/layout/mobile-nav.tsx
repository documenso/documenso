'use client';

import { HTMLAttributes } from 'react';

import { cn } from '@documenso/ui/lib/utils';

export type MobileNavProps = HTMLAttributes<HTMLDivElement>;

// Todo: Teams
export const MobileNav = ({ className, ...props }: MobileNavProps) => {
  // const pathname = usePathname();

  // const { getFlag } = useFeatureFlags();

  // const isBillingEnabled = getFlag('app_billing');

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
      todo
      {/* <Link href="/settings/profile">
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
      )} */}
    </div>
  );
};
