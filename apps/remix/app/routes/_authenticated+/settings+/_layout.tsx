import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { canExecuteOrganisationAction, isPersonalLayout } from '@documenso/lib/utils/organisations';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  BracesIcon,
  CreditCardIcon,
  Globe2Icon,
  LockIcon,
  Settings2Icon,
  UserIcon,
  UsersIcon,
  WebhookIcon,
} from 'lucide-react';
import { Outlet } from 'react-router';

import { SettingsNav, type SettingsNavRoute } from '~/components/general/settings-nav';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Settings`);
}

export default function SettingsLayout() {
  const { t } = useLingui();

  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const hasManageableBillingOrgs = organisations.some((org) =>
    canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
  );

  const settingRoutes: SettingsNavRoute[] = [
    {
      path: '/settings/profile',
      label: t`Profile`,
      icon: UserIcon,
    },
    ...(isPersonalLayoutMode
      ? [
          {
            path: '/settings/document',
            label: t`Preferences`,
            icon: Settings2Icon,
            isSectionLabel: true,
          },
          {
            path: '/settings/document',
            label: t`Document`,
            isSubNav: true,
          },
          {
            path: '/settings/branding',
            label: t`Branding`,
            isSubNav: true,
          },
          {
            path: '/settings/email',
            label: t`Email`,
            isSubNav: true,
          },
          {
            path: '/settings/public-profile',
            label: t`Public Profile`,
            icon: Globe2Icon,
          },
          {
            path: '/settings/tokens',
            label: t`API Tokens`,
            icon: BracesIcon,
          },
          {
            path: '/settings/webhooks',
            label: t`Webhooks`,
            icon: WebhookIcon,
          },
        ]
      : []),
    {
      path: '/settings/organisations',
      label: t`Organisations`,
      icon: UsersIcon,
    },
    ...(IS_BILLING_ENABLED() && hasManageableBillingOrgs
      ? [
          {
            path: isPersonalLayoutMode ? '/settings/billing-personal' : '/settings/billing',
            label: t`Billing`,
            icon: CreditCardIcon,
          },
        ]
      : []),
    {
      path: '/settings/security',
      label: t`Security`,
      icon: LockIcon,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="font-semibold text-4xl">
        <Trans>Settings</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <SettingsNav routes={settingRoutes} className="col-span-12 mb-8 md:col-span-3 md:mb-0" />

        <div className="col-span-12 max-w-3xl md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
