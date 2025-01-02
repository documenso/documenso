import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Forgot password');
}

export default function ForgotPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">
          <Trans>Email sent!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            A password reset email has been sent, if you have an account you should see it in your
            inbox shortly.
          </Trans>
        </p>

        <Button asChild>
          <Link to="/signin">
            <Trans>Return to sign in</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
