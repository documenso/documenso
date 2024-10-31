'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { Braces, CreditCard, Globe2Icon, Key, User, Webhook } from 'lucide-react';

import { useFeatureFlags } from '@documenso/lib/client-only/providers/feature-flag';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type MobileNavProps = HTMLAttributes<HTMLDivElement>;

export const MobileNav = ({ className, ...props }: MobileNavProps) => {
  const pathname = usePathname();
  const params = useParams();

  const { getFlag } = useFeatureFlags();

  const isPublicProfileEnabled = getFlag('app_public_profile');

  const teamUrl = typeof params?.teamUrl === 'string' ? params?.teamUrl : '';

  const settingsPath = `/t/${teamUrl}/settings`;
  const publicProfilePath = `/t/${teamUrl}/settings/public-profile`;
  const membersPath = `/t/${teamUrl}/settings/members`;
  const tokensPath = `/t/${teamUrl}/settings/tokens`;
  const webhooksPath = `/t/${teamUrl}/settings/webhooks`;
  const billingPath = `/t/${teamUrl}/settings/billing`;

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
      <Link href={settingsPath}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(settingsPath) &&
              pathname.split('/').length === 4 &&
              'bg-secondary',
          )}
        >
          <User className="mr-2 h-5 w-5" />
          <Trans>General</Trans>
        </Button>
      </Link>

      {isPublicProfileEnabled && (
        <Link href={publicProfilePath}>
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith(publicProfilePath) && 'bg-secondary',
            )}
          >
            <Globe2Icon className="mr-2 h-5 w-5" />
            <Trans>Public Profile</Trans>
          </Button>
        </Link>
      )}

      <Link href={membersPath}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(membersPath) && 'bg-secondary',
          )}
        >
          <Key className="mr-2 h-5 w-5" />
          <Trans>Members</Trans>
        </Button>
      </Link>

      <Link href={tokensPath}>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', pathname?.startsWith(tokensPath) && 'bg-secondary')}
        >
          <Braces className="mr-2 h-5 w-5" />
          <Trans>API Tokens</Trans>
        </Button>
      </Link>

      <Link href={webhooksPath}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(webhooksPath) && 'bg-secondary',
          )}
        >
          <Webhook className="mr-2 h-5 w-5" />
          <Trans>Webhooks</Trans>
        </Button>
      </Link>

      {IS_BILLING_ENABLED() && (
        <Link href={billingPath}>
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              pathname?.startsWith(billingPath) && 'bg-secondary',
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
