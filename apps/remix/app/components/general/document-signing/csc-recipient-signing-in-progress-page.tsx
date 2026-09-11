import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type CscRecipientSigningInProgressPageProps = {
  sessionId: string;
  recipientToken: string;
};

/**
 * Rendered when the credential-scope OAuth callback has attached a SAD to the
 * server-side `CscSession` and set the `csc_sad_session` cookie. The page
 * auto-fires `enterprise.csc.signEnvelope` on mount and navigates to the
 * completion page on success. On failure, it surfaces an error message and
 * a retry CTA pointing at a fresh credential-scope OAuth round-trip.
 */
export const CscRecipientSigningInProgressPage = ({
  sessionId,
  recipientToken,
}: CscRecipientSigningInProgressPageProps) => {
  const { mutateAsync: signEnvelope } = trpc.enterprise.csc.signEnvelope.useMutation();

  const [error, setError] = useState<string | null>(null);

  // Ref rather than state for the fire-once guard. Refs mutate synchronously,
  // so React StrictMode's double-invoke of the effect sees the updated value
  // on the second pass and short-circuits. A useState guard would still let
  // the second effect fire because the queued setState from the first run
  // hasn't been committed yet when the second one reads it — that double-fire
  // races two signEnvelope calls; whichever loses sees the SAD already
  // consumed and flashes "Signing failed" before the winning call's
  // navigation kicks in.
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) {
      return;
    }

    hasFiredRef.current = true;

    const run = async () => {
      try {
        await signEnvelope({ sessionId, recipientToken });

        window.location.href = `/sign/${recipientToken}/complete`;
      } catch (err) {
        const parsed = AppError.parseError(err);
        setError(parsed.code || AppErrorCode.UNKNOWN_ERROR);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryUrl = `/api/csc/oauth/authorize?scope=credential&session=${encodeURIComponent(sessionId)}`;

  return (
    <div className="-mx-4 flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pt-16 md:-mx-8 md:px-8 lg:pt-16 xl:pt-24">
      {error ? (
        <>
          <AlertTriangleIcon className="h-12 w-12 text-destructive" />

          <h2 className="mt-6 max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl lg:text-4xl">
            <Trans>Signing failed</Trans>
          </h2>

          <p className="mt-2.5 max-w-[60ch] text-center font-medium text-muted-foreground/60 text-sm md:text-base">
            {error === AppErrorCode.CSC_TSP_TIMEOUT ? (
              <Trans>The signing provider did not respond in time. Please retry.</Trans>
            ) : error === AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN ? (
              <Trans>
                Your signing authorisation expired before the signature could be applied. Please reauthorise to retry.
              </Trans>
            ) : (
              <Trans>Something went wrong while applying your signature. Please retry.</Trans>
            )}
          </p>

          <Button asChild className="mt-8">
            <a href={retryUrl}>
              <Trans>Reauthorise and retry</Trans>
            </a>
          </Button>
        </>
      ) : (
        <>
          <Loader2Icon className="h-12 w-12 animate-spin text-primary" />

          <h2 className="mt-6 max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl lg:text-4xl">
            <Trans>Applying your signature</Trans>
          </h2>

          <p className="mt-2.5 max-w-[60ch] text-center font-medium text-muted-foreground/60 text-sm md:text-base">
            <Trans>Please don't close this tab. The signing provider is finalising your signature.</Trans>
          </p>
        </>
      )}
    </div>
  );
};
