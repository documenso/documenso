import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { XCircle } from 'lucide-react';
import { Link } from 'react-router';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Verify Email`);
}

export default function EmailVerificationWithoutTokenPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mt-1 mr-4 hidden md:block">
          <XCircle className="h-10 w-10 text-destructive" strokeWidth={2} />
        </div>

        <div>
          <h2 className="font-bold text-2xl md:text-4xl">
            <Trans>Uh oh! Looks like you're missing a token</Trans>
          </h2>

          <p className="mt-4 text-muted-foreground">
            <Trans>
              It seems that there is no token provided, if you are trying to verify your email please follow the link in
              your email.
            </Trans>
          </p>

          <Button className="mt-4" asChild>
            <Link to="/">
              <Trans>Go back home</Trans>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
