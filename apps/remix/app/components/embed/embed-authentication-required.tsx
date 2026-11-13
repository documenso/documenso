import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Trans } from '@lingui/react/macro';

import { EmbedPopupAuth } from '~/components/embed/embed-popup-auth';
import { BrandingLogo } from '~/components/general/branding-logo';

export type EmbedAuthenticationRequiredProps = {
  email?: string;
};

// Rendered from an ErrorBoundary, so providers come from public env rather than loader data.
export const EmbedAuthenticationRequired = ({ email }: EmbedAuthenticationRequiredProps) => {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col">
        <BrandingLogo className="h-8" />

        <Alert className="mt-8" variant="warning">
          <AlertDescription>
            <Trans>To view this document you need to be signed into your account, please sign in to continue.</Trans>
          </AlertDescription>
        </Alert>

        <EmbedPopupAuth className="mt-4" email={email} onSuccess={() => window.location.reload()} />
      </div>
    </div>
  );
};
