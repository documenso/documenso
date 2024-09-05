import { Trans } from '@lingui/macro';

import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';

import { Logo } from '~/components/branding/logo';
import { SignInForm } from '~/components/forms/signin';

export type EmbedAuthenticateViewProps = {
  email?: string;
  returnTo: string;
};

export const EmbedAuthenticateView = ({ email, returnTo }: EmbedAuthenticateViewProps) => {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col">
        <Logo className="h-8" />

        <Alert className="mt-8" variant="warning">
          <AlertDescription>
            <Trans>
              To view this document you need to be signed into your account, please sign in to
              continue.
            </Trans>
          </AlertDescription>
        </Alert>

        <SignInForm className="mt-4" initialEmail={email} returnTo={returnTo} />
      </div>
    </div>
  );
};
