import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import { CreditCard, Lock, User, Users } from 'lucide-react';
import { useLocation } from 'react-router';
import { Link } from 'react-router';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type SettingsDesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const SettingsDesktopNav = ({ className, ...props }: SettingsDesktopNavProps) => {
  const { pathname } = useLocation();

  const isBillingEnabled = IS_BILLING_ENABLED();

  return (
    <div className={cn('flex flex-col gap-y-2', className)} {...props}>
      <Link to="/settings/profile">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/profile') && 'bg-secondary',
          )}
        >
          <User className="mr-2 h-5 w-5" />
          <Trans>Profile</Trans>
        </Button>
      </Link>

      <Link to="/settings/organisations">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/organisations') && 'bg-secondary',
          )}
        >
          <Users className="mr-2 h-5 w-5" />
          <Trans>Organisations</Trans>
        </Button>
      </Link>

      <Link to="/settings/security">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith('/settings/security') && 'bg-secondary',
          )}
        >
          <Lock className="mr-2 h-5 w-5" />
          <Trans>Security</Trans>
        </Button>
      </Link>

      {isBillingEnabled && (
        <Link to="/settings/billing">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith('/settings/billing') && 'bg-secondary',
            )}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            <Trans>Billing</Trans>
          </Button>
        </Link>
      )}
    </div>
  );
};
