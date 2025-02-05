import { useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useNavigate } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentSigningAuthPageViewProps = {
  email: string;
  emailHasAccount?: boolean;
};

export const DocumentSigningAuthPageView = ({
  email,
  emailHasAccount,
}: DocumentSigningAuthPageViewProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      // Todo: Redirect false
      await authClient.signOut();

      await navigate(emailHasAccount ? `/signin#email=${email}` : `/signup#email=${email}`);
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
