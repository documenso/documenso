import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { BookIcon, HelpCircleIcon, Link2Icon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { Button } from '@documenso/ui/primitives/button';

import { SupportTicketForm } from '~/components/forms/support-ticket-form';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Support');
}

export default function SupportPage() {
  const [showForm, setShowForm] = useState(false);
  const { user } = useSession();
  const organisation = useCurrentOrganisation();

  const [searchParams] = useSearchParams();

  const teamId = searchParams.get('team');

  const subscriptionStatus = organisation.subscription?.status;

  const handleSuccess = () => {
    setShowForm(false);
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <h1 className="flex flex-row items-center gap-2 text-3xl font-bold">
          <HelpCircleIcon className="h-8 w-8 text-muted-foreground" />
          <Trans>Support</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground">
          <Trans>Your current plan includes the following support channels:</Trans>
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BookIcon className="h-5 w-5 text-muted-foreground" />
              <Trans>Documentation</Trans>
            </h2>
            <p className="mt-1 text-muted-foreground">
              <Trans>Read our documentation to get started.</Trans>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Link2Icon className="h-5 w-5 text-muted-foreground" />
              <Link
                to="https://documen.so/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Trans>Discord</Trans>
              </Link>
            </h2>
            <p className="mt-1 text-muted-foreground">
              <Trans>
                Join our community on{' '}
                <Link
                  to="https://documen.so/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Discord
                </Link>{' '}
                for community support and discussion.
              </Trans>
            </p>
          </div>
          {organisation && IS_BILLING_ENABLED() && subscriptionStatus && (
            <>
              <div className="rounded-lg border p-4">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Link2Icon className="h-5 w-5 text-muted-foreground" />
                  <Trans>Contact us</Trans>
                </h2>
                <p className="mt-1 text-muted-foreground">
                  <Trans>We'll get back to you as soon as possible via email.</Trans>
                </p>
                <div className="mt-4">
                  {!showForm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                      <Trans>Create a support ticket</Trans>
                    </Button>
                  ) : (
                    <SupportTicketForm
                      organisationId={organisation.id}
                      teamId={teamId}
                      onSuccess={handleSuccess}
                      onClose={handleCloseForm}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
