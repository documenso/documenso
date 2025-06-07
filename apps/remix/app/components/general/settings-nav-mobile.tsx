import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import {
  BracesIcon,
  CreditCardIcon,
  Globe2Icon,
  Lock,
  Settings2Icon,
  User,
  Users,
  WebhookIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type SettingsMobileNavProps = HTMLAttributes<HTMLDivElement>;

export const SettingsMobileNav = ({ className, ...props }: SettingsMobileNavProps) => {
  const { pathname } = useLocation();

  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
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

      {isPersonalLayoutMode && (
        <>
          <Link to="/settings/preferences">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start',
                pathname?.startsWith('/settings/preferences') && 'bg-secondary',
              )}
            >
              <Settings2Icon className="mr-2 h-5 w-5" />
              <Trans>Preferences</Trans>
            </Button>
          </Link>

          <Link to="/settings/public-profile">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start',
                pathname?.startsWith('/settings/public-profile') && 'bg-secondary',
              )}
            >
              <Globe2Icon className="mr-2 h-5 w-5" />
              <Trans>Public Profile</Trans>
            </Button>
          </Link>

          <Link to="/settings/tokens">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start',
                pathname?.startsWith('/settings/tokens') && 'bg-secondary',
              )}
            >
              <BracesIcon className="mr-2 h-5 w-5" />
              <Trans>API Tokens</Trans>
            </Button>
          </Link>

          <Link to="/settings/webhooks">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start',
                pathname?.startsWith('/settings/webhooks') && 'bg-secondary',
              )}
            >
              <WebhookIcon className="mr-2 h-5 w-5" />
              <Trans>Webhooks</Trans>
            </Button>
          </Link>

          {IS_BILLING_ENABLED() && (
            <Link to="/settings/billing">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start',
                  pathname?.startsWith('/settings/billing') && 'bg-secondary',
                )}
              >
                <CreditCardIcon className="mr-2 h-5 w-5" />
                <Trans>Billing</Trans>
              </Button>
            </Link>
          )}
        </>
      )}

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
    </div>
  );
};
