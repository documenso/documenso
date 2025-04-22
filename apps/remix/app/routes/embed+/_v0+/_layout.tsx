import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router';

import {
  IS_GOOGLE_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';

import { EmbedAuthenticationRequired } from '~/components/embed/embed-authentication-required';
import { EmbedDocumentWaitingForTurn } from '~/components/embed/embed-document-waiting-for-turn';
import { EmbedPaywall } from '~/components/embed/embed-paywall';

import type { Route } from './+types/_layout';

// Todo: (RR7) Test
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const origin = loaderHeaders.get('Origin') ?? '*';

  // Allow third parties to iframe the document.
  return {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Content-Security-Policy': `frame-ancestors ${origin}`,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function loader() {
  // SSR env variables.
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED;
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED;
  const oidcProviderLabel = OIDC_PROVIDER_LABEL;

  return {
    isGoogleSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
  };
}

export default function Layout() {
  return <Outlet />;
}

export function ErrorBoundary({ loaderData }: Route.ErrorBoundaryProps) {
  const { isGoogleSSOEnabled, isOIDCSSOEnabled, oidcProviderLabel } = loaderData || {};

  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 401 && error.data.type === 'embed-authentication-required') {
      return (
        <EmbedAuthenticationRequired
          isGoogleSSOEnabled={isGoogleSSOEnabled}
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
  }

  return <div>Not Found</div>;
}
