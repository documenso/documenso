import { extractCookieFromHeaders } from '@documenso/auth/server/lib/utils/cookies';
import { extractCookieFromDocument } from '@documenso/lib/client-only/cookies';
import type { RouteHandle } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { PREFERRED_TEAM_URL_COOKIE } from '@documenso/lib/constants/cookies';
import { msg } from '@lingui/core/macro';

import { UnifiedSettingsLayout } from '~/components/general/unified-settings-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/_layout';

export function meta() {
  return appMetaTags(msg`Settings`);
}

export const handle: RouteHandle = {
  layoutMode: 'settings',
};

/**
 * Only runs on the initial document request (SSR) so the first paint has the
 * correct preferred team without a hydration mismatch.
 */
export function loader({ request }: Route.LoaderArgs) {
  return {
    preferredTeamUrl: extractCookieFromHeaders(PREFERRED_TEAM_URL_COOKIE, request.headers),
  };
}

/**
 * Runs instead of the server loader on client-side navigations, otherwise every
 * settings page switch would trigger a `.data` round-trip to the server just to
 * read this cookie.
 *
 * The cookie is not `HttpOnly` so it can be read straight from the document.
 */
export function clientLoader() {
  return {
    preferredTeamUrl: extractCookieFromDocument(PREFERRED_TEAM_URL_COOKIE),
  };
}

export default function SettingsLayout({ loaderData }: Route.ComponentProps) {
  return <UnifiedSettingsLayout activeScope="account" preferredTeamUrl={loaderData.preferredTeamUrl} />;
}
