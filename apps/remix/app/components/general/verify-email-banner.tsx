import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle } from 'lucide-react';

import { authClient } from '@documenso/auth/client';
import { ONE_DAY, ONE_SECOND } from '@documenso/lib/constants/time';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type VerifyEmailBannerProps = {
  email: string;
};

const RESEND_CONFIRMATION_EMAIL_TIMEOUT = 20 * ONE_SECOND;

export const VerifyEmailBanner = ({ email }: VerifyEmailBannerProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  const onResendConfirmationEmail = async () => {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      setIsButtonDisabled(true);
      await authClient.emailPassword.resendVerifyEmail({ email: email });

      toast({
        title: _(msg`Success`),
        description: _(msg`Verification email sent successfully.`),
      });

      setIsOpen(false);
      setTimeout(() => setIsButtonDisabled(false), RESEND_CONFIRMATION_EMAIL_TIMEOUT);
    } catch (err) {
      setIsButtonDisabled(false);

      toast({
        title: _(msg`Error`),
        description: _(msg`Something went wrong while sending the confirmation email.`),
        variant: 'destructive',
      });
    }

    setIsPending(false);
  };

  useEffect(() => {
    // Check localStorage to see if we've recently automatically displayed the dialog
    // if it was within the past 24 hours, don't show it again
    // otherwise, show it again and update the localStorage timestamp
    const emailVerificationDialogLastShown = localStorage.getItem(
      'emailVerificationDialogLastShown',
    );

    if (emailVerificationDialogLastShown) {
      const lastShownTimestamp = parseInt(emailVerificationDialogLastShown);

      if (Date.now() - lastShownTimestamp < ONE_DAY) {
        return;
      }
    }

    setIsOpen(true);

    localStorage.setItem('emailVerificationDialogLastShown', Date.now().toString());
  }, []);

  return (
    <>
      <div className="bg-yellow-200 dark:bg-yellow-400">
        <div className="mx-auto flex max-w-screen-xl items-center justify-center gap-x-4 px-4 py-2 text-sm font-medium text-yellow-900">
          <div className="flex items-center">
            <AlertTriangle className="mr-2.5 h-5 w-5" />
            <Trans>Verify your email address to unlock all features.</Trans>
          </div>

          <div>
            <Button
              variant="ghost"
              className="h-auto px-2.5 py-1.5 text-yellow-900 hover:bg-yellow-100 hover:text-yellow-900 dark:hover:bg-yellow-500"
              disabled={isButtonDisabled}
              onClick={() => setIsOpen(true)}
              size="sm"
            >
              {isButtonDisabled ? (
                <Trans>Verification Email Sent</Trans>
              ) : (
                <Trans>Verify Now</Trans>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogTitle>
            <Trans>Verify your email address</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              We've sent a confirmation email to <strong>{email}</strong>. Please check your inbox
              and click the link in the email to verify your account.
            </Trans>
          </DialogDescription>

          <div>
            <Button
              disabled={isButtonDisabled}
              loading={isPending}
              onClick={onResendConfirmationEmail}
            >
              {isPending ? <Trans>Sending...</Trans> : <Trans>Resend Confirmation Email</Trans>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
