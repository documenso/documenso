import { useEmbedPopupAuth } from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';

import { EmbedPopupAuthFlowStatus } from '~/components/embed/embed-popup-auth';
import { BrandingLogo } from '~/components/general/branding-logo';
import { getCscRecipientBlockedCopy } from '~/components/general/document-signing/csc-recipient-blocked-page';

export type EmbedCscAuthenticationRequiredProps = {
  token: string;

  blockedCode?: string;
};

export const EmbedCscAuthenticationRequired = ({ token, blockedCode }: EmbedCscAuthenticationRequiredProps) => {
  const { status, error, start, continueWithStorageAccess, cancel } = useEmbedPopupAuth({
    onSuccess: () => window.location.reload(),
  });

  const isBusy = status !== 'idle' && status !== 'error';

  const blockedCopy = blockedCode ? getCscRecipientBlockedCopy(blockedCode) : null;

  const onStartClick = () => {
    start('csc', { csc: { scope: 'service', token } });
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col gap-y-4">
        <BrandingLogo className="mb-4 h-8" />

        {blockedCopy ? (
          <Alert variant="destructive">
            <AlertTitle>{blockedCopy.title}</AlertTitle>

            <AlertDescription>{blockedCopy.description}</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning">
            <AlertDescription>
              <Trans>
                This document requires a qualified electronic signature. Sign in with your signing provider to continue.
              </Trans>
            </AlertDescription>
          </Alert>
        )}

        <fieldset className="flex w-full flex-col" disabled={isBusy}>
          <Button type="button" size="lg" onClick={onStartClick}>
            {blockedCode ? <Trans>Try again</Trans> : <Trans>Sign in with your signing provider</Trans>}
          </Button>
        </fieldset>

        <EmbedPopupAuthFlowStatus
          status={status}
          error={error}
          onCancel={cancel}
          onContinueWithStorageAccess={continueWithStorageAccess}
          waitingMessage={<Trans>Complete sign in with your signing provider in the popup window</Trans>}
        />
      </div>
    </div>
  );
};
