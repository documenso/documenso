import type {
  EmbedPopupAuthError,
  EmbedPopupAuthProvider,
  EmbedPopupAuthStatus,
} from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { useEmbedPopupAuth } from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { isSigninEnabledForProvider } from '@documenso/lib/constants/auth';
import { getEmbedPopupAuthProviders } from '@documenso/lib/constants/embed-auth';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { KeyRoundIcon, Loader2Icon, MailIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { FaIdCardClip } from 'react-icons/fa6';
import { FcGoogle } from 'react-icons/fc';
import { match } from 'ts-pattern';

export type EmbedPopupAuthProps = {
  className?: string;

  email?: string;

  // No sign out step is needed; redeem always overwrites the embed session cookie.
  signedInAs?: string;

  onSuccess: () => void;
};

export const EmbedPopupAuth = ({ className, email, signedInAs, onSuccess }: EmbedPopupAuthProps) => {
  const { status, error, start, continueWithStorageAccess, cancel } = useEmbedPopupAuth({ onSuccess });

  const providers = getEmbedPopupAuthProviders();

  const isIdle = status === 'idle' || status === 'error';
  const isBusy = !isIdle;

  const isEmailPasswordSigninEnabled = isSigninEnabledForProvider('email');

  const onProviderClick = (provider: Exclude<EmbedPopupAuthProvider, 'csc'>) => {
    start(provider, { email });
  };

  return (
    <div className={cn('flex w-full flex-col gap-y-4', className)}>
      {signedInAs && (
        <p className="text-muted-foreground text-sm">
          <Trans>
            You are currently signed in as <strong>{signedInAs}</strong>. Signing in below will switch accounts.
          </Trans>
        </p>
      )}

      <fieldset className="flex w-full flex-col gap-y-4" disabled={isBusy}>
        {providers.account && (
          <Button type="button" size="lg" onClick={() => onProviderClick('account')}>
            {isEmailPasswordSigninEnabled ? (
              <>
                <MailIcon className="mr-2 h-4 w-4" />
                <Trans>Sign in with email or passkey</Trans>
              </>
            ) : (
              <>
                <KeyRoundIcon className="mr-2 h-4 w-4" />
                <Trans>Sign in with passkey</Trans>
              </>
            )}
          </Button>
        )}

        {providers.google && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="border bg-background text-muted-foreground"
            onClick={() => onProviderClick('google')}
          >
            <FcGoogle className="mr-2 h-5 w-5" />
            Google
          </Button>
        )}

        {providers.microsoft && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="border bg-background text-muted-foreground"
            onClick={() => onProviderClick('microsoft')}
          >
            <img className="mr-2 h-4 w-4" alt="Microsoft Logo" src={'/static/microsoft.svg'} />
            Microsoft
          </Button>
        )}

        {providers.oidc && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="border bg-background text-muted-foreground"
            onClick={() => onProviderClick('oidc')}
          >
            <FaIdCardClip className="mr-2 h-5 w-5" />
            {providers.oidcProviderLabel || 'OIDC'}
          </Button>
        )}
      </fieldset>

      <EmbedPopupAuthFlowStatus
        status={status}
        error={error}
        onCancel={cancel}
        onContinueWithStorageAccess={continueWithStorageAccess}
      />
    </div>
  );
};

export type EmbedPopupAuthFlowStatusProps = {
  status: EmbedPopupAuthStatus;
  error: EmbedPopupAuthError | null;
  onCancel: () => void;
  onContinueWithStorageAccess: () => void | Promise<void>;

  waitingMessage?: ReactNode;
};

export const EmbedPopupAuthFlowStatus = ({
  status,
  error,
  onCancel,
  onContinueWithStorageAccess,
  waitingMessage,
}: EmbedPopupAuthFlowStatusProps) => {
  return (
    <>
      {(status === 'waiting' || status === 'redeeming') && (
        <div className="flex flex-col items-center gap-y-3">
          <p className="flex items-center justify-center gap-x-2 text-center text-muted-foreground text-sm">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            {status === 'waiting' ? (
              (waitingMessage ?? <Trans>Complete sign in in the popup window</Trans>)
            ) : (
              <Trans>Signing you in...</Trans>
            )}
          </p>

          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      )}

      {status === 'needs-storage-access' && (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Almost there</Trans>
          </AlertTitle>

          <AlertDescription>
            <Trans>
              Your browser needs permission to keep you signed in inside this embed. Press Continue and allow access
              when Safari asks.
            </Trans>
          </AlertDescription>

          <Button type="button" size="sm" className="mt-2" onClick={() => void onContinueWithStorageAccess()}>
            <Trans>Continue</Trans>
          </Button>
        </Alert>
      )}

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertDescription>
            <EmbedPopupAuthErrorMessage error={error} />
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

const EmbedPopupAuthErrorMessage = ({ error }: { error: EmbedPopupAuthError }) => {
  return match(error)
    .with('popup-blocked', () => (
      <Trans>Your browser blocked the sign in window. Allow popups for this site and try again.</Trans>
    ))
    .with('timeout', () => <Trans>Sign in timed out. Please try again.</Trans>)
    .with('auth-failed', () => <Trans>Sign in did not complete. Please try again.</Trans>)
    .with('cookie-blocked', () => (
      <Trans>
        Your browser is blocking the cookies needed to keep you signed in inside this embed. Open this document in a new
        tab instead.
      </Trans>
    ))
    .with('storage-access-denied', () => (
      <Trans>Storage access was denied, so we cannot keep you signed in inside this embed. Please try again.</Trans>
    ))
    .with('request-failed', () => <Trans>Something went wrong while signing you in. Please try again.</Trans>)
    .exhaustive();
};
