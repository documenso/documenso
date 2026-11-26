import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { RouteHandle } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { LicenseClient } from '@documenso/lib/server-only/license/license-client';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { findActiveSettingsNav, getAdminNavGroups, getSettingsNavCrumbs } from '@documenso/lib/utils/settings-nav';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Outlet, redirect, useLocation } from 'react-router';

import { AdminLicenseStatusBanner } from '~/components/general/admin-license-status-banner';
import { SettingsLayoutShell } from '~/components/general/settings-layout-shell';
import { SettingsScopeBreadcrumb } from '~/components/general/settings-scope-breadcrumb';
import { SettingsSidebar, SettingsSidebarGroup } from '~/components/general/settings-sidebar';
import { SettingsSidebarMobile, SettingsSidebarMobileHeading } from '~/components/general/settings-sidebar-mobile';
import { adminMiddleware } from '~/middleware/admin';
import { appMetaTags } from '~/utils/meta';
import type { Route } from './+types/_layout';

export function meta() {
  return appMetaTags(msg`Admin`);
}

export const handle: RouteHandle = {
  layoutMode: 'settings',
};

export const middleware = [adminMiddleware];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const license = await LicenseClient.getInstance()?.getCachedLicense();

  if (!user || !isAdmin(user)) {
    throw redirect('/');
  }

  return {
    license: license || null,
  };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { license } = loaderData;

  const { t } = useLingui();
  const { pathname } = useLocation();

  const navGroups = getAdminNavGroups();

  const activeNav = findActiveSettingsNav(navGroups, pathname);

  const activeItem = activeNav?.item ?? null;

  const crumbs = getSettingsNavCrumbs(activeNav).map((label) => t(label));

  return (
    <SettingsLayoutShell
      width="wide"
      // The rule form's sticky panel sizes itself to the pane with `cqh`.
      isSizeContainer
      sidebar={
        <SettingsSidebar data-testid="admin-sidebar">
          {navGroups.map((group, index) => (
            <SettingsSidebarGroup
              key={group.label?.id ?? index}
              heading={group.label ? t(group.label) : null}
              items={group.items}
              activeItem={activeItem}
              scope={group.scope}
            />
          ))}
        </SettingsSidebar>
      }
      mobileSidebar={
        <SettingsSidebarMobile
          data-testid="admin-sidebar-mobile"
          heading={
            <SettingsSidebarMobileHeading>
              <Trans>Admin Panel</Trans>
            </SettingsSidebarMobileHeading>
          }
          groups={navGroups}
          activeItem={activeItem}
        />
      }
    >
      {/* Page titles are `SettingsHeader` h2s, so the panel name is the h1 for screen readers. */}
      <h1 className="sr-only">
        <Trans>Admin Panel</Trans>
      </h1>

      <AdminLicenseStatusBanner license={license} />

      <SettingsScopeBreadcrumb
        scope="admin"
        scopeName={activeNav?.group.label ? t(activeNav.group.label) : t`Admin`}
        crumbs={crumbs}
      />

      <Outlet />
    </SettingsLayoutShell>
  );
}
