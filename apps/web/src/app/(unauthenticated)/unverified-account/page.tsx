import { Trans } from '@lingui/macro';
import { Mails } from 'lucide-react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { SendConfirmationEmailForm } from '~/components/forms/send-confirmation-email';

export default function UnverifiedAccount() {
  setupI18nSSR();

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <Mails className="text-primary h-10 w-10" strokeWidth={2} />
        </div>
        <div className="">
          <h2 className="text-2xl font-bold md:text-4xl">
            <Trans>Confirm email</Trans>
          </h2>

          <p className="text-muted-foreground mt-4">
            <Trans>
              To gain access to your account, please confirm your email address by clicking on the
              confirmation link from your inbox.
            </Trans>
          </p>

          <p className="text-muted-foreground mt-4">
            <Trans>
              If you don't find the confirmation link in your inbox, you can request a new one
              below.
            </Trans>
          </p>

          <SendConfirmationEmailForm />
        </div>
      </div>
    </div>
  );
}
