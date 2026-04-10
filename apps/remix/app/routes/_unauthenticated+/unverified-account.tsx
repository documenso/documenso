import { Trans } from '@lingui/react/macro';
import { Mails } from 'lucide-react';

import { SendConfirmationEmailForm } from '~/components/forms/send-confirmation-email';

export default function UnverifiedAccount() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex items-start">
        <div className="mt-1 mr-4 hidden md:block">
          <Mails className="h-10 w-10 text-primary" strokeWidth={2} />
        </div>
        <div className="">
          <h2 className="font-bold text-2xl md:text-4xl">
            <Trans>Confirm email</Trans>
          </h2>

          <p className="mt-4 text-muted-foreground">
            <Trans>
              To gain access to your account, please confirm your email address by clicking on the confirmation link
              from your inbox.
            </Trans>
          </p>

          <p className="mt-4 text-muted-foreground">
            <Trans>If you don't find the confirmation link in your inbox, you can request a new one below.</Trans>
          </p>

          <SendConfirmationEmailForm />
        </div>
      </div>
    </div>
  );
}
