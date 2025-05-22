import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import { Braces, Globe2Icon, GroupIcon, Key, Settings2, User, Webhook } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type TeamSettingsNavMobileProps = HTMLAttributes<HTMLDivElement>;

export const TeamSettingsNavMobile = ({ className, ...props }: TeamSettingsNavMobileProps) => {
  const { pathname } = useLocation();
  const params = useParams();

  const teamUrl = typeof params?.teamUrl === 'string' ? params?.teamUrl : '';

  const settingsPath = `/t/${teamUrl}/settings`;
  const preferencesPath = `/t/${teamUrl}/preferences`;
  const publicProfilePath = `/t/${teamUrl}/settings/public-profile`;
  const membersPath = `/t/${teamUrl}/settings/members`;
  const groupsPath = `/t/${teamUrl}/settings/groups`;
  const tokensPath = `/t/${teamUrl}/settings/tokens`;
  const webhooksPath = `/t/${teamUrl}/settings/webhooks`;

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
      <Link to={settingsPath}>
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

      <Link to={preferencesPath}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start',
            pathname?.startsWith(preferencesPath) &&
              pathname.split('/').length === 4 &&
              'bg-secondary',
          )}
        >
          <Settings2 className="mr-2 h-5 w-5" />
          <Trans>Preferences</Trans>
        </Button>
      </Link>

      <Link to={publicProfilePath}>
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

      <Link to={membersPath}>
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

      <Link to={groupsPath}>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', pathname?.startsWith(groupsPath) && 'bg-secondary')}
        >
          <GroupIcon className="mr-2 h-5 w-5" />
          <Trans>Groups</Trans>
        </Button>
      </Link>

      <Link to={tokensPath}>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', pathname?.startsWith(tokensPath) && 'bg-secondary')}
        >
          <Braces className="mr-2 h-5 w-5" />
          <Trans>API Tokens</Trans>
        </Button>
      </Link>

      <Link to={webhooksPath}>
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
    </div>
  );
};
