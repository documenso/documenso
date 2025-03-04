/**
 * https://posthog.com/docs/advanced/proxy/remix
 */
import type { Route } from './+types/ingest.$';

const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';

const posthogProxy = async (request: Request) => {
  const url = new URL(request.url);
  const hostname = url.pathname.startsWith('/ingest/static/') ? ASSET_HOST : API_HOST;

  const newUrl = new URL(url);
  newUrl.protocol = 'https';
  newUrl.hostname = hostname;
  newUrl.port = '443';
  newUrl.pathname = newUrl.pathname.replace(/^\/ingest/, '');

  const headers = new Headers(request.headers);
  headers.set('host', hostname);

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    fetchOptions.body = request.body;
    // @ts-expect-error - It should exist
    fetchOptions.duplex = 'half';
  }

  const response = await fetch(newUrl, fetchOptions);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('cookie');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

export async function loader({ request }: Route.LoaderArgs) {
  return posthogProxy(request);
}

export async function action({ request }: Route.ActionArgs) {
  return posthogProxy(request);
}
