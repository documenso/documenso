import { authClient } from '@documenso/auth/client';
import { isSigninEnabledForProvider } from '@documenso/lib/constants/auth';
import type { EmbedPopupAuthCscOptions, EmbedPopupAuthProvider } from '@documenso/lib/constants/embed-auth';
import {
  EMBED_AUTH_MESSAGE_FAILED,
  EMBED_AUTH_MESSAGE_READY,
  getEmbedPopupAuthProviders,
  ZEmbedAuthNonceMessageSchema,
  ZEmbedPopupAuthCscOptionsSchema,
  ZEmbedPopupAuthProviderSchema,
} from '@documenso/lib/constants/embed-auth';
import { AppError } from '@documenso/lib/errors/app-error';
import { zEmail } from '@documenso/lib/utils/zod';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { data, isRouteErrorResponse } from 'react-router';
import { match } from 'ts-pattern';

import { SignInForm } from '~/components/forms/signin';
import { BrandingLogo } from '~/components/general/branding-logo';

import type { Route } from './+types/popup';

const READY_PING_INTERVAL_MS = 250;

const READY_PING_TIMEOUT_MS = 10_000;

type PopupErrorCode = 'opener-missing' | 'opener-timeout' | 'request-failed' | 'csc-options-invalid';

type PopupState =
  | { status: 'connecting' }
  | { status: 'starting' }
  | { status: 'ready'; redirectUrl: string }
  | { status: 'redirecting' }
  | { status: 'account'; returnTo: string; email?: string }
  | { status: 'unverified-email' }
  | { status: 'error'; code: PopupErrorCode; message?: string };

type HashOptions = {
  email?: string;
  csc?: EmbedPopupAuthCscOptions;
};

// Clears the fragment so the recipient token does not linger in history and
// `SignInForm` (which also reads `#email`) only sees the validated prop.
const consumeHashOptions = (): HashOptions => {
  const params = new URLSearchParams(window.location.hash.slice(1));

  if (window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  const parsedEmail = zEmail().safeParse(params.get('email'));

  const parsedCsc = ZEmbedPopupAuthCscOptionsSchema.safeParse({
    scope: params.get('scope') ?? undefined,
    token: params.get('token') ?? undefined,
    sessionId: params.get('sessionId') ?? undefined,
  });

  return {
    email: parsedEmail.success ? parsedEmail.data : undefined,
    csc: parsedCsc.success ? parsedCsc.data : undefined,
  };
};

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const parsedProvider = ZEmbedPopupAuthProviderSchema.safeParse(url.searchParams.get('provider'));

  if (!parsedProvider.success) {
    throw data(
      {
        type: 'invalid-provider',
      },
      {
        status: 400,
      },
    );
  }

  return {
    provider: parsedProvider.data,
  };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isInvalidProvider = isRouteErrorResponse(error) && error.status === 400;

  return (
    <EmbedAuthPopupLayout>
      <ErrorLine>
        {isInvalidProvider ? (
          <Trans>Unknown sign in provider.</Trans>
        ) : (
          <Trans>Something went wrong. Close this window and try again.</Trans>
        )}
      </ErrorLine>
    </EmbedAuthPopupLayout>
  );
}

export default function EmbedAuthPopupPage({ loaderData }: Route.ComponentProps) {
  const { provider } = loaderData;

  const [state, setState] = useState<PopupState>({ status: 'connecting' });

  // COOP-enforcing IdPs sever `window.opener` only after we navigate to them,
  // so the handshake here is unaffected; only the completion page copes with a null opener.
  useEffect(() => {
    const opener: Window | null = window.opener;

    if (!opener) {
      setState({ status: 'error', code: 'opener-missing' });

      return;
    }

    let hasReceivedNonce = false;
    let readyInterval: number | null = null;
    let readyTimeout: number | null = null;

    const postReady = () => {
      opener.postMessage({ type: EMBED_AUTH_MESSAGE_READY }, window.location.origin);
    };

    const stopReadyPings = () => {
      if (readyInterval !== null) {
        window.clearInterval(readyInterval);
        readyInterval = null;
      }

      if (readyTimeout !== null) {
        window.clearTimeout(readyTimeout);
        readyTimeout = null;
      }
    };

    const startFlow = async (nonce: string) => {
      setState({ status: 'starting' });

      const { email, csc } = consumeHashOptions();

      if (provider === 'csc' && !csc) {
        setState({ status: 'error', code: 'csc-options-invalid' });

        return;
      }

      try {
        const { redirectUrl, returnTo } = await authClient.embed.start({
          nonce,
          provider,
          csc: provider === 'csc' ? csc : undefined,
        });

        if (returnTo !== null) {
          setState({ status: 'account', returnTo, email });

          return;
        }

        if (redirectUrl === null) {
          setState({ status: 'error', code: 'request-failed' });

          return;
        }

        // Deliberately not navigating here; see `RedirectPrompt`.
        setState({ status: 'ready', redirectUrl });
      } catch (err) {
        const error = AppError.parseError(err);

        setState({
          status: 'error',
          code: 'request-failed',
          message: error.userMessage ?? error.message,
        });
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== opener) {
        return;
      }

      const parsed = ZEmbedAuthNonceMessageSchema.safeParse(event.data);

      if (!parsed.success) {
        return;
      }

      if (hasReceivedNonce) {
        return;
      }

      hasReceivedNonce = true;

      stopReadyPings();

      void startFlow(parsed.data.nonce);
    };

    window.addEventListener('message', onMessage);

    readyInterval = window.setInterval(postReady, READY_PING_INTERVAL_MS);

    readyTimeout = window.setTimeout(() => {
      if (hasReceivedNonce) {
        return;
      }

      stopReadyPings();

      setState({ status: 'error', code: 'opener-timeout' });
    }, READY_PING_TIMEOUT_MS);

    postReady();

    return () => {
      stopReadyPings();

      window.removeEventListener('message', onMessage);
    };
  }, [provider]);

  const isTerminal = state.status === 'error' || state.status === 'unverified-email';

  useEffect(() => {
    if (!isTerminal) {
      return;
    }

    const opener: Window | null = window.opener;

    if (opener) {
      opener.postMessage({ type: EMBED_AUTH_MESSAGE_FAILED }, window.location.origin);
    }
  }, [isTerminal]);

  return (
    <EmbedAuthPopupLayout isCsc={provider === 'csc'}>
      {match(state)
        .with({ status: 'connecting' }, () => (
          <StatusLine>
            <Trans>Connecting to the embed...</Trans>
          </StatusLine>
        ))
        .with({ status: 'starting' }, () => (
          <StatusLine>
            <Trans>Starting sign in...</Trans>
          </StatusLine>
        ))
        .with({ status: 'ready' }, ({ redirectUrl }) => (
          <RedirectPrompt
            provider={provider}
            onContinue={() => {
              setState({ status: 'redirecting' });

              window.location.href = redirectUrl;
            }}
          />
        ))
        .with({ status: 'redirecting' }, () => (
          <StatusLine>
            <Trans>Redirecting to your sign in provider...</Trans>
          </StatusLine>
        ))
        .with({ status: 'account' }, ({ returnTo, email }) => (
          // Password recovery and email verification would navigate away from
          // the flow, so they are handled as terminal states instead.
          <SignInForm
            className="w-full max-w-sm"
            initialEmail={email}
            isEmailPasswordSigninEnabled={isSigninEnabledForProvider('email')}
            returnTo={returnTo}
            hideForgotPassword
            onUnverifiedEmail={() => setState({ status: 'unverified-email' })}
          />
        ))
        .with({ status: 'unverified-email' }, () => (
          <p className="text-center text-muted-foreground text-sm">
            <Trans>Verify your email, then close this window and try again.</Trans>
          </p>
        ))
        .with({ status: 'error' }, ({ code, message }) => (
          <ErrorLine>
            {match(code)
              .with('opener-missing', () => <Trans>This window must be opened from a Documenso embed.</Trans>)
              .with('opener-timeout', () => (
                <Trans>Could not connect to the Documenso embed. Close this window and try again.</Trans>
              ))
              .with('csc-options-invalid', () => (
                <Trans>This signing request is missing its details. Close this window and try again.</Trans>
              ))
              .with('request-failed', () =>
                message ? (
                  message
                ) : (
                  <Trans>We were unable to start the sign in flow. Close this window and try again.</Trans>
                ),
              )
              .exhaustive()}
          </ErrorLine>
        ))
        .exhaustive()}
    </EmbedAuthPopupLayout>
  );
}

/**
 * This click is load-bearing. WebKit only grants `requestStorageAccess()` in
 * the iframe if the user has recently interacted with our origin as a top-level
 * page, and with an auto-redirect they never would have.
 * https://webkit.org/blog/11545/updates-to-the-storage-access-api/
 */
const RedirectPrompt = ({ provider, onContinue }: { provider: EmbedPopupAuthProvider; onContinue: () => void }) => {
  const { oidcProviderLabel } = getEmbedPopupAuthProviders();

  return (
    <div className="flex w-full max-w-sm flex-col gap-y-4">
      <p className="text-center text-muted-foreground text-sm">
        <Trans>You will be redirected to sign in, then returned here.</Trans>
      </p>

      <Button type="button" size="lg" onClick={onContinue}>
        {match(provider)
          .with('google', () => <Trans>Continue with Google</Trans>)
          .with('microsoft', () => <Trans>Continue with Microsoft</Trans>)
          .with('oidc', () => <Trans>Continue with {oidcProviderLabel || 'OIDC'}</Trans>)
          .with('csc', () => <Trans>Continue to your signing provider</Trans>)
          .with('account', () => <Trans>Continue</Trans>)
          .exhaustive()}
      </Button>
    </div>
  );
};

const StatusLine = ({ children }: { children: ReactNode }) => {
  return (
    <p className="flex items-center justify-center gap-x-2 text-muted-foreground text-sm">
      <Loader2Icon className="h-4 w-4 animate-spin" />
      {children}
    </p>
  );
};

const ErrorLine = ({ children }: { children: ReactNode }) => {
  return <p className="text-center text-destructive text-sm">{children}</p>;
};

const EmbedAuthPopupLayout = ({ children, isCsc = false }: { children: ReactNode; isCsc?: boolean }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-y-8 px-6 py-8">
      <div className="flex flex-col items-center gap-y-4">
        <BrandingLogo className="h-6 w-auto" />

        <h1 className="text-center font-medium text-sm">
          {isCsc ? (
            <Trans>Sign in with your signing provider to continue</Trans>
          ) : (
            <Trans>Sign in to Documenso to continue</Trans>
          )}
        </h1>
      </div>

      {children}
    </div>
  );
};
