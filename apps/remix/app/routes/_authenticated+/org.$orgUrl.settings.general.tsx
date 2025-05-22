import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';

import { OrganisationDeleteDialog } from '~/components/dialogs/organisation-delete-dialog';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { OrganisationUpdateForm } from '~/components/forms/organisation-update-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Settings');
}

export default function OrganisationSettingsGeneral() {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={_(msg`General`)}
        subtitle={_(msg`Here you can edit your organisation details.`)}
      />

      <div className="space-y-8">
        <AvatarImageForm organisation={organisation} />
        <OrganisationUpdateForm />
      </div>

      {canExecuteOrganisationAction(
        'DELETE_ORGANISATION',
        organisation.currentOrganisationRole,
      ) && (
        <>
          <hr className="my-4" />

          <Alert
            className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Delete organisation</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                <Trans>
                  This organisation, and any associated data will be permanently deleted.
                </Trans>
              </AlertDescription>
            </div>

            <OrganisationDeleteDialog />
          </Alert>
        </>
      )}
    </div>
  );
}
