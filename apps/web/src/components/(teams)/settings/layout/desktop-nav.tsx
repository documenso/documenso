'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { Braces, CreditCard, Settings, Users, Webhook } from 'lucide-react';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type DesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const DesktopNav = ({ className, ...props }: DesktopNavProps) => {
  const pathname = usePathname();
  const params = useParams();

  const teamUrl = typeof params?.teamUrl === 'string' ? params?.teamUrl : '';

  const settingsPath = `/t/${teamUrl}/settings`;
  const membersPath = `/t/${teamUrl}/settings/members`;
  const tokensPath = `/t/${teamUrl}/settings/tokens`;
  const webhooksPath = `/t/${teamUrl}/settings/webhooks`;
  const billingPath = `/t/${teamUrl}/settings/billing`;

  return (
    <div className={cn('flex flex-col gap-y-2', className)} {...props}>
      <Link href={settingsPath}>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', pathname === settingsPath && 'bg-secondary')}
        >
          <Settings className="mr-2 h-5 w-5" />
          General
        </Button>
      </Link>

      <Link href={membersPath}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(membersPath) && 'bg-secondary',
          )}
        >
          <Users className="mr-2 h-5 w-5" />
          Members
        </Button>
      </Link>

      <Link href={tokensPath}>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', pathname?.startsWith(tokensPath) && 'bg-secondary')}
        >
          <Braces className="mr-2 h-5 w-5" />
          API Tokens
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
          Webhooks
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
            Billing
          </Button>
        </Link>
      )}
    </div>
  );
};
