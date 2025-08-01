import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { canExecuteOrganisationAction, isPersonalLayout } from '@documenso/lib/utils/organisations';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { OrganisationEmailDomainCreateDialog } from '~/components/dialogs/organisation-email-domain-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationEmailDomainsDataTable } from '~/components/tables/organisation-email-domains-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Email Domains');
}

export default function OrganisationSettingsEmailDomains() {
  const { t } = useLingui();
  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const isEmailDomainsEnabled = organisation.organisationClaim.flags.emailDomains;

  if (!IS_BILLING_ENABLED()) {
    return null;
  }

  return (
    <div>
      <SettingsHeader
        title={t`Email Domains`}
        subtitle={t`Here you can add email domains to your organisation.`}
      >
        {isEmailDomainsEnabled && <OrganisationEmailDomainCreateDialog />}
      </SettingsHeader>

      {isEmailDomainsEnabled ? (
        <section>
          <OrganisationEmailDomainsDataTable />
        </section>
      ) : (
        <Alert
          className="mt-8 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>
              <Trans>Email Domains</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>
                Currently email domains can only be configured for Platform and above plans.
              </Trans>
            </AlertDescription>
          </div>

          {canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole) && (
            <Button asChild variant="outline">
              <Link
                to={
                  isPersonalLayoutMode
                    ? '/settings/billing'
                    : `/o/${organisation.url}/settings/billing`
                }
              >
                <Trans>Update Billing</Trans>
              </Link>
            </Button>
          )}
        </Alert>
      )}
    </div>
  );
}
