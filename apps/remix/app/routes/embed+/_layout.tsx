import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router';

import { EmbedAuthenticationRequired } from '~/components/embed/embed-authentication-required';
import { EmbedPaywall } from '~/components/embed/embed-paywall';

import type { Route } from './+types/_layout';

// Todo: Test
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

export default function Layout() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 401 && error.data.type === 'embed-authentication-required') {
      return (
        <EmbedAuthenticationRequired email={error.data.email} returnTo={error.data.returnTo} />
      );
    }

    if (error.status === 403 && error.data.type === 'embed-paywall') {
      return <EmbedPaywall />;
    }
  }

  return <div>Not Found</div>;
}
