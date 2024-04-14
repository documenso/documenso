import { Mails } from 'lucide-react';

import { SendConfirmationEmailForm } from '~/components/forms/send-confirmation-email';

export default function UnverifiedAccount() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <Mails className="text-primary h-10 w-10" strokeWidth={2} />
        </div>
        <div className="">
          <h2 className="text-2xl font-bold md:text-4xl">Confirm email</h2>

          <p className="text-muted-foreground mt-4">
            To gain access to your account, please confirm your email address by clicking on the
            confirmation link from your inbox.
          </p>

          <p className="text-muted-foreground mt-4">
            If you don't find the confirmation link in your inbox, you can request a new one below.
          </p>

          <SendConfirmationEmailForm />
        </div>
      </div>
    </div>
  );
}
