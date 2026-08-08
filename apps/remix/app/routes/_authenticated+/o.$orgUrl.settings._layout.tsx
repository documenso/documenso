import { extractCookieFromHeaders } from '@documenso/auth/server/lib/utils/cookies';
import type { RouteHandle } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { PREFERRED_TEAM_URL_COOKIE } from '@documenso/lib/constants/cookies';
import { msg } from '@lingui/core/macro';

import { UnifiedSettingsLayout } from '~/components/general/unified-settings-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.settings._layout';

export function meta() {
  return appMetaTags(msg`Organisation Settings`);
}

export const handle: RouteHandle = {
  layoutMode: 'settings',
};

export function loader({ request }: Route.LoaderArgs) {
  return {
    preferredTeamUrl: extractCookieFromHeaders(PREFERRED_TEAM_URL_COOKIE, request.headers),
  };
}

export default function OrganisationSettingsLayout({ loaderData }: Route.ComponentProps) {
  return <UnifiedSettingsLayout activeScope="organisation" preferredTeamUrl={loaderData.preferredTeamUrl} />;
}
