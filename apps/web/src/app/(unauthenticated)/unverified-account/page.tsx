'use client';

import { useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { Mails } from 'lucide-react';

import { ONE_SECOND } from '@documenso/lib/constants/time';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

const RESEND_CONFIRMATION_EMAIL_TIMEOUT = 20 * ONE_SECOND;

export default function UnverifiedAccount() {
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const token = searchParams?.get('t') ?? '';

  const { data: { email } = {} } = trpc.profile.getUserFromVerificationToken.useQuery({ token });

  const { mutateAsync: sendConfirmationEmail } = trpc.profile.sendConfirmationEmail.useMutation();

  const onResendConfirmationEmail = async () => {
    if (!email) {
      toast({
        title: 'Unable to send confirmation email',
        description: 'Something went wrong while sending the confirmation email. Please try again.',
        variant: 'destructive',
      });

      return;
    }

    try {
      setIsButtonDisabled(true);

      await sendConfirmationEmail({ email: email });

      toast({
        title: 'Success',
        description: 'Verification email sent successfully.',
        duration: 5000,
      });

      setTimeout(() => setIsButtonDisabled(false), RESEND_CONFIRMATION_EMAIL_TIMEOUT);
    } catch (err) {
      setIsButtonDisabled(false);

      toast({
        title: 'Error',
        description: 'Something went wrong while sending the confirmation email.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex w-full items-start">
      <div className="mr-4 mt-1 hidden md:block">
        <Mails className="text-primary h-10 w-10" strokeWidth={2} />
      </div>
      <div className="">
        <h2 className="text-2xl font-bold md:text-4xl">Confirm email</h2>

        <p className="text-muted-foreground mt-4">
          To gain full access to your account and unlock all its features, please confirm your email
          address by clicking on the link sent to your email address.
        </p>

        <Button className="mt-4" disabled={isButtonDisabled} onClick={onResendConfirmationEmail}>
          Resend email
        </Button>
      </div>
    </div>
  );
}
