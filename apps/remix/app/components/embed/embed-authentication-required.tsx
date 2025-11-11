import { Trans } from '@lingui/react/macro';

import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';

import { SignInForm } from '~/components/forms/signin';
import { BrandingLogo } from '~/components/general/branding-logo';

export type EmbedAuthenticationRequiredProps = {
  email?: string;
  returnTo: string;
  isGoogleSSOEnabled?: boolean;
  isMicrosoftSSOEnabled?: boolean;
  isOIDCSSOEnabled?: boolean;
  oidcProviderLabel?: string;
};

export const EmbedAuthenticationRequired = ({
  email,
  returnTo,
  // isGoogleSSOEnabled,
  // isMicrosoftSSOEnabled,
  // isOIDCSSOEnabled,
  // oidcProviderLabel,
}: EmbedAuthenticationRequiredProps) => {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col">
        <BrandingLogo className="h-8" />

        <Alert className="mt-8" variant="warning">
          <AlertDescription>
            <Trans>
              To view this document you need to be signed into your account, please sign in to
              continue.
            </Trans>
          </AlertDescription>
        </Alert>

        <SignInForm
          // Embed currently not supported.
          // isGoogleSSOEnabled={isGoogleSSOEnabled}
          // isMicrosoftSSOEnabled={isMicrosoftSSOEnabled}
          // isOIDCSSOEnabled={isOIDCSSOEnabled}
          // oidcProviderLabel={oidcProviderLabel}
          className="mt-4"
          initialEmail={email}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
};
