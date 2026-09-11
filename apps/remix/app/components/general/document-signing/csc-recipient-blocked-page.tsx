import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon } from 'lucide-react';

export type CscRecipientBlockedPageProps = {
  code: string;
  recipientToken: string;
};

/**
 * Terminal page rendered when the service-scope CSC OAuth callback surfaces a
 * hard error the recipient can't resolve themselves (empty credential list,
 * invalid cert, refused algorithm). The blocking-error cookie is read +
 * cleared by the loader; this page only renders the message + retry CTA.
 *
 * The retry link kicks a fresh service-scope OAuth round-trip — useful when
 * the TSP-side issue is transient (e.g. the recipient's admin has since
 * provisioned a credential).
 */
export const CscRecipientBlockedPage = ({ code, recipientToken }: CscRecipientBlockedPageProps) => {
  const retryUrl = `/api/csc/oauth/authorize?scope=service&token=${encodeURIComponent(recipientToken)}`;

  return (
    <div className="-mx-4 flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pt-16 md:-mx-8 md:px-8 lg:pt-16 xl:pt-24">
      <AlertTriangleIcon className="h-12 w-12 text-destructive" />

      <h2 className="mt-6 max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl lg:text-4xl">
        {code === AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY ? (
          <Trans>No signing credentials available</Trans>
        ) : code === AppErrorCode.CSC_CERT_INVALID ? (
          <Trans>Signing certificate is invalid</Trans>
        ) : code === AppErrorCode.CSC_ALGORITHM_REFUSED ? (
          <Trans>Signing algorithm is not supported</Trans>
        ) : (
          <Trans>Unable to start the signing flow</Trans>
        )}
      </h2>

      <p className="mt-2.5 max-w-[60ch] text-center font-medium text-muted-foreground/60 text-sm md:text-base">
        {code === AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY ? (
          <Trans>
            Your signing provider returned no usable credentials for this account. Contact your administrator or signing
            provider for assistance.
          </Trans>
        ) : code === AppErrorCode.CSC_CERT_INVALID ? (
          <Trans>
            Your signing certificate is invalid, expired, or missing a required key. Contact your administrator or
            signing provider for assistance.
          </Trans>
        ) : code === AppErrorCode.CSC_ALGORITHM_REFUSED ? (
          <Trans>
            Your signing provider does not advertise a signing algorithm this document accepts. Contact your
            administrator or signing provider for assistance.
          </Trans>
        ) : (
          <Trans>Something went wrong while preparing the remote signature. Please try again.</Trans>
        )}
      </p>

      <Button asChild className="mt-8">
        <a href={retryUrl}>
          <Trans>Try again</Trans>
        </a>
      </Button>
    </div>
  );
};
