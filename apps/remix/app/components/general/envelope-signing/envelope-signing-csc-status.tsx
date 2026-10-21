import type { EmbedPopupAuth } from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import { match } from 'ts-pattern';

import { EmbedPopupAuthFlowStatus } from '~/components/embed/embed-popup-auth';

export type EnvelopeSigningCscStatusProps = {
  popupAuth: Pick<EmbedPopupAuth, 'status' | 'error' | 'continueWithStorageAccess'>;

  /** True while the signature is being applied or the page is navigating away after success. */
  isSigning: boolean;

  /** Error code from the sign mutation, if the signature could not be applied after authorisation. */
  signErrorCode: string | null;

  onCancel: () => void;
  onRetry: () => void;
};

/**
 * Body of the completion dialog while an embedded recipient authorises and
 * applies a CSC (AES/QES) signature via the popup flow.
 */
export const EnvelopeSigningCscStatus = ({
  popupAuth,
  isSigning,
  signErrorCode,
  onCancel,
  onRetry,
}: EnvelopeSigningCscStatusProps) => {
  const hasSignError = signErrorCode !== null;
  const canRetry = popupAuth.status === 'error' || hasSignError;

  return (
    <div className="flex flex-col gap-y-4">
      {isSigning ? (
        <p className="flex items-center justify-center gap-x-2 text-center text-muted-foreground text-sm">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          <Trans>Applying your signature...</Trans>
        </p>
      ) : (
        <EmbedPopupAuthFlowStatus
          status={popupAuth.status}
          error={popupAuth.error}
          onCancel={onCancel}
          onContinueWithStorageAccess={popupAuth.continueWithStorageAccess}
          waitingMessage={<Trans>Authorise your signature with your signing provider in the popup window</Trans>}
        />
      )}

      {hasSignError && (
        <Alert variant="destructive">
          <AlertDescription>
            <EnvelopeSigningCscSignErrorMessage code={signErrorCode} />
          </AlertDescription>
        </Alert>
      )}

      {canRetry && (
        <Button type="button" onClick={onRetry}>
          {hasSignError ? <Trans>Reauthorise and retry</Trans> : <Trans>Try again</Trans>}
        </Button>
      )}
    </div>
  );
};

const EnvelopeSigningCscSignErrorMessage = ({ code }: { code: string }) => {
  return match(code)
    .with(AppErrorCode.CSC_TSP_TIMEOUT, () => (
      <Trans>The signing provider did not respond in time. Please retry.</Trans>
    ))
    .with(AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN, () => (
      <Trans>
        Your signing authorisation expired before the signature could be applied. Please reauthorise to retry.
      </Trans>
    ))
    .otherwise(() => <Trans>Something went wrong while applying your signature. Please retry.</Trans>);
};
