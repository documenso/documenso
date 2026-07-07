import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Building2Icon,
  CreditCardIcon,
  GroupIcon,
  MailboxIcon,
  Settings2Icon,
  ShieldCheckIcon,
  Users2Icon,
  UsersIcon,
} from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsNav, type SettingsNavRoute } from '~/components/general/settings-nav';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Organisation Settings`);
}

export default function SettingsLayout() {
  const { t } = useLingui();

  const isBillingEnabled = IS_BILLING_ENABLED();
  const organisation = useCurrentOrganisation();

  const organisationSettingRoutes: SettingsNavRoute[] = [
    {
      path: `/o/${organisation.url}/settings/general`,
      label: t`General`,
      icon: Building2Icon,
    },
    {
      path: `/o/${organisation.url}/settings/document`,
      label: t`Preferences`,
      icon: Settings2Icon,
      isSectionLabel: true,
    },
    {
      path: `/o/${organisation.url}/settings/document`,
      label: t`Document`,
      isSubNav: true,
    },
    {
      path: `/o/${organisation.url}/settings/branding`,
      label: t`Branding`,
      isSubNav: true,
    },
    {
      path: `/o/${organisation.url}/settings/email`,
      label: t`Email`,
      isSubNav: true,
    },
    {
      path: `/o/${organisation.url}/settings/email-domains`,
      label: t`Email Domains`,
      icon: MailboxIcon,
    },
    {
      path: `/o/${organisation.url}/settings/teams`,
      label: t`Teams`,
      icon: UsersIcon,
    },
    {
      path: `/o/${organisation.url}/settings/members`,
      label: t`Members`,
      icon: Users2Icon,
    },
    {
      path: `/o/${organisation.url}/settings/groups`,
      label: t`Groups`,
      icon: GroupIcon,
    },
    {
      path: `/o/${organisation.url}/settings/sso`,
      label: t`SSO`,
      icon: ShieldCheckIcon,
    },
    {
      path: `/o/${organisation.url}/settings/billing`,
      label: t`Billing`,
      icon: CreditCardIcon,
    },
  ].filter((route) => {
    if (!isBillingEnabled && route.path.includes('/billing')) {
      return false;
    }

    if (
      (!isBillingEnabled || !organisation.organisationClaim.flags.emailDomains) &&
      route.path.includes('/email-domains')
    ) {
      return false;
    }

    if (
      (!isBillingEnabled || !organisation.organisationClaim.flags.authenticationPortal) &&
      route.path.includes('/sso')
    ) {
      return false;
    }

    return true;
  });

  if (!canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole)) {
    return (
      <GenericErrorLayout
        errorCode={401}
        errorCodeMap={{
          401: {
            heading: msg`Unauthorized`,
            subHeading: msg`401 Unauthorized`,
            message: msg`You are not authorized to access this page.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/o/${organisation.url}`}>
              <Trans>Go Back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <h1 className="font-semibold text-4xl">
        <Trans>Organisation Settings</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <SettingsNav routes={organisationSettingRoutes} className="col-span-12 mb-8 md:col-span-3 md:mb-0" />

        <div className="col-span-12 max-w-3xl md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
