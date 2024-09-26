'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { signOut } from 'next-auth/react';

import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type SigningAuthPageViewProps = {
  email: string;
  emailHasAccount?: boolean;
};

export const SigningAuthPageView = ({ email, emailHasAccount }: SigningAuthPageViewProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      await signOut({
        redirect: false,
      });

      router.push(emailHasAccount ? `/signin#email=${email}` : `/signup#email=${email}`);
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to log you out at this time.`),
        duration: 10000,
        variant: 'destructive',
      });
    }

    setIsSigningOut(false);
  };

  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <h1 className="text-3xl font-semibold">
          <Trans>Authentication required</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            You need to be logged in as <strong>{email}</strong> to view this page.
          </Trans>
        </p>

        <Button
          className="mt-4 w-full"
          type="submit"
          onClick={async () => handleChangeAccount(email)}
          loading={isSigningOut}
        >
          {emailHasAccount ? <Trans>Login</Trans> : <Trans>Sign up</Trans>}
        </Button>
      </div>
    </div>
  );
};
