import { Trans } from '@lingui/react/macro';
import { XCircle } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Verify Email');
}

export default function EmailVerificationWithoutTokenPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">
            <Trans>Uh oh! Looks like you're missing a token</Trans>
          </h2>

          <p className="text-muted-foreground mt-4">
            <Trans>
              It seems that there is no token provided, if you are trying to verify your email
              please follow the link in your email.
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
