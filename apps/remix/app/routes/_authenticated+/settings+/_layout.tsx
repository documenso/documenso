import type { RouteHandle } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { msg } from '@lingui/core/macro';

import { UnifiedSettingsLayout } from '~/components/general/unified-settings-layout';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Settings`);
}

export const handle: RouteHandle = {
  layoutMode: 'settings',
};

export default function SettingsLayout() {
  return <UnifiedSettingsLayout activeScope="account" />;
}
