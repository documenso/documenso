import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Reset Password');
}

export default function ResetPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">
          <Trans>Unable to reset password</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            The token you have used to reset your password is either expired or it never existed. If
            you have still forgotten your password, please request a new reset link.
          </Trans>
        </p>

        <Button className="mt-4" asChild>
          <Link to="/signin">
            <Trans>Return to sign in</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
