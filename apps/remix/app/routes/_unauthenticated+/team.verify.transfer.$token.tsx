import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/team.verify.transfer.$token';

export default function VerifyTeamTransferPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">
          <Trans>Invalid link</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>This link is invalid or has expired.</Trans>
        </p>

        <Button asChild>
          <Link to="/">
            <Trans>Return</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
