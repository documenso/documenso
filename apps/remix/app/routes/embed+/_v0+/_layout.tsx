import { Trans } from '@lingui/react/macro';
import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router';

import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';

import { EmbedAuthenticationRequired } from '~/components/embed/embed-authentication-required';
import { EmbedDocumentCompleted } from '~/components/embed/embed-document-completed';
import { EmbedDocumentRejected } from '~/components/embed/embed-document-rejected';
import { EmbedDocumentWaitingForTurn } from '~/components/embed/embed-document-waiting-for-turn';
import { EmbedPaywall } from '~/components/embed/embed-paywall';
import { EmbedRecipientExpired } from '~/components/embed/embed-recipient-expired';

import type { Route } from './+types/_layout';

// Note: CSP (`frame-ancestors *`), `Referrer-Policy`, and
// `X-Content-Type-Options` are now emitted globally by
// `securityHeadersMiddleware` for any path under `/embed`. See
// `apps/remix/server/security-headers.ts`.
//
// The previous `Access-Control-Allow-*` headers here only ever applied to
// HTML page renders, where CORS preflight does not apply, so they were a
// no-op and have been dropped along with the rest of `headers()`.

export function loader() {
  // SSR env variables.
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED;
  const isMicrosoftSSOEnabled = IS_MICROSOFT_SSO_ENABLED;
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED;
  const oidcProviderLabel = OIDC_PROVIDER_LABEL;

  return {
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
  };
}

export default function Layout() {
  return <Outlet />;
}

export function ErrorBoundary({ loaderData }: Route.ErrorBoundaryProps) {
  const { isGoogleSSOEnabled, isMicrosoftSSOEnabled, isOIDCSSOEnabled, oidcProviderLabel } =
    loaderData || {};

  const error = useRouteError();

  console.log({ routeError: error });

  if (isRouteErrorResponse(error)) {
    if (error.status === 401 && error.data.type === 'embed-authentication-required') {
      return (
        <EmbedAuthenticationRequired
          isGoogleSSOEnabled={isGoogleSSOEnabled}
          isMicrosoftSSOEnabled={isMicrosoftSSOEnabled}
          isOIDCSSOEnabled={isOIDCSSOEnabled}
          oidcProviderLabel={oidcProviderLabel}
          email={error.data.email}
          returnTo={error.data.returnTo}
        />
      );
    }

    if (error.status === 403 && error.data.type === 'embed-paywall') {
      return <EmbedPaywall />;
    }

    if (error.status === 403 && error.data.type === 'embed-waiting-for-turn') {
      return <EmbedDocumentWaitingForTurn />;
    }

    if (error.status === 403 && error.data.type === 'embed-recipient-expired') {
      return <EmbedRecipientExpired />;
    }

    // !: Not used at the moment, may be removed in the future.
    if (error.status === 403 && error.data.type === 'embed-document-rejected') {
      return <EmbedDocumentRejected />;
    }

    // !: Not used at the moment, may be removed in the future.
    if (error.status === 403 && error.data.type === 'embed-document-completed') {
      return <EmbedDocumentCompleted name={error.data.name} signature={error.data.signature} />;
    }
  }

  return (
    <div>
      <Trans>Not Found</Trans>
    </div>
  );
}
