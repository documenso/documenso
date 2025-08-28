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
} from 'lucide-react';
import { FaUsers } from 'react-icons/fa6';
import { Link, NavLink, Outlet } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Organisation Settings');
}

export default function SettingsLayout() {
  const { t } = useLingui();

  const isBillingEnabled = IS_BILLING_ENABLED();
  const organisation = useCurrentOrganisation();

  const organisationSettingRoutes = [
    {
      path: `/o/${organisation.url}/settings/general`,
      label: t`General`,
      icon: Building2Icon,
    },
    {
      path: `/o/${organisation.url}/settings/document`,
      label: t`Preferences`,
      icon: Settings2Icon,
      hideHighlight: true,
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
      icon: FaUsers,
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
      <h1 className="text-4xl font-semibold">
        <Trans>Organisation Settings</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        {/* Navigation */}
        <div
          className={cn(
            'col-span-12 mb-8 flex flex-wrap items-center justify-start gap-x-2 gap-y-4 md:col-span-3 md:w-full md:flex-col md:items-start md:gap-y-2',
          )}
        >
          {organisationSettingRoutes.map((route) => (
            <NavLink
              to={route.path}
              className={cn('group w-full justify-start', route.isSubNav && 'pl-8')}
              key={route.path}
            >
              <Button
                variant="ghost"
                className={cn('w-full justify-start', {
                  'group-aria-[current]:bg-secondary': !route.hideHighlight,
                })}
              >
                {route.icon && <route.icon className="mr-2 h-5 w-5" />}
                <Trans>{route.label}</Trans>
              </Button>
            </NavLink>
          ))}
        </div>

        <div className="col-span-12 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
