'use client';

import { useState } from 'react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

export type VerifyEmailBannerProps = {
  userEmail: string;
};

export const VerifyEmailBanner = ({ userEmail }: VerifyEmailBannerProps) => {
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const { mutateAsync: sendConfirmationEmail } = trpc.profile.sendConfirmationEmail.useMutation();

  const onResendConfirmationEmail = async () => {
    setIsButtonDisabled(true);
    await sendConfirmationEmail({ email: userEmail });
    setTimeout(() => setIsButtonDisabled(false), 20000);
  };

  return (
    <div className="relative isolate mb-4 flex items-center gap-x-6 overflow-hidden bg-yellow-400 px-6 py-4 sm:px-3.5 sm:before:flex-1">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <p className="text-sm leading-6 text-gray-900">
          <strong className="font-semibold">Hey, {userEmail}</strong>
          <svg
            viewBox="0 0 2 2"
            className="mx-2 inline h-0.5 w-0.5 fill-current"
            aria-hidden="true"
          >
            <circle cx={1} cy={1} r={1} />
          </svg>
          It seems that you haven't confirmed your email yet. For complete access, please confirm
          your email.
        </p>
        <Button
          className="flex-none rounded-full bg-gray-900 px-3.5 py-1 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          onClick={onResendConfirmationEmail}
          disabled={isButtonDisabled}
        >
          {isButtonDisabled ? 'Please check your email' : 'Resend confirmation email'}
        </Button>
      </div>
      <div className="flex flex-1 justify-end"></div>
    </div>
  );
};
