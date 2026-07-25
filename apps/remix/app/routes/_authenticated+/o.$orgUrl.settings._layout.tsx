import type { RouteHandle } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { msg } from '@lingui/core/macro';

import { UnifiedSettingsLayout } from '~/components/general/unified-settings-layout';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Organisation Settings`);
}

export const handle: RouteHandle = {
  layoutMode: 'settings',
};

export default function OrganisationSettingsLayout() {
  return <UnifiedSettingsLayout activeScope="organisation" />;
}
