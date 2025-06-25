import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { BookIcon, HelpCircleIcon, Link2Icon, MailIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { SupportTicketForm } from '~/components/forms/support-ticket-form';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Support');
}

export default function SupportPage() {
  const [open, setOpen] = useState(false);
  const currentOrganisation = useOptionalCurrentOrganisation();

  const subscriptionStatus = currentOrganisation?.subscription?.status;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <h1 className="flex flex-row items-center gap-2 text-3xl font-bold">
          <HelpCircleIcon className="text-muted-foreground h-8 w-8" />
          <Trans>Support</Trans>
        </h1>

        <p className="text-muted-foreground mt-1">
          <Trans>Choose a support channel below to get help with Documenso</Trans>
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BookIcon className="text-muted-foreground h-5 w-5" />
              <Link
                to="https://docs.documenso.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Trans>Documentation</Trans>
              </Link>
            </h2>
            <p className="text-muted-foreground mt-1">
              <Trans>Read our documentation to get started with Documenso.</Trans>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Link2Icon className="text-muted-foreground h-5 w-5" />
              <Link
                to="https://documen.so/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Trans>Discord</Trans>
              </Link>
            </h2>
            <p className="text-muted-foreground mt-1">
              <Trans>
                Join our community on{' '}
                <a href="https://documen.so/discord" target="_blank" rel="noopener noreferrer">
                  Discord
                </a>{' '}
                for community support and discussion.
              </Trans>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MailIcon className="text-muted-foreground h-5 w-5" />
              <Link
                to="mailto:support@documenso.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Trans>Email</Trans>
              </Link>
            </h2>

            <p className="text-muted-foreground mt-1">
              <Trans>
                Send an email to <a href="mailto:support@documenso.com">support@documenso.com</a>.
              </Trans>
            </p>
          </div>
          {currentOrganisation && subscriptionStatus === SubscriptionStatus.ACTIVE && (
            <div className="rounded-lg border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Link2Icon className="text-muted-foreground h-5 w-5" />
                <Trans>Plain</Trans>
              </h2>
              <p className="text-muted-foreground mt-1">
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Trans>Create a support ticket</Trans>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        <Trans>Create a support ticket</Trans>
                      </DialogTitle>
                    </DialogHeader>
                    <SupportTicketForm onSuccess={() => setOpen(false)} />
                  </DialogContent>
                </Dialog>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
