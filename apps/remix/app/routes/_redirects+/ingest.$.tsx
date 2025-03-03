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

  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('cookie');

  const response = await fetch(newUrl, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-expect-error - Not really sure about this
    duplex: 'half',
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export async function loader({ request }: Route.LoaderArgs) {
  return posthogProxy(request);
}

export async function action({ request }: Route.ActionArgs) {
  return posthogProxy(request);
}
