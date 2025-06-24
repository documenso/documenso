import { Trans } from '@lingui/react/macro';
import { HelpCircleIcon, Link2Icon, MailIcon } from 'lucide-react';
import { Link } from 'react-router';

export default function SupportPage() {
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
        </div>
      </div>
    </div>
  );
}
