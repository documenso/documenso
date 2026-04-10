import { authClient } from '@documenso/auth/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

export const DirectTemplateAuthPageView = () => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async () => {
    try {
      setIsSigningOut(true);

      await authClient.signOut();
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
        <h1 className="font-semibold text-3xl">
          <Trans>Authentication required</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>You need to be logged in to view this page.</Trans>
        </p>

        <Button
          className="mt-4 w-full"
          type="submit"
          onClick={async () => handleChangeAccount()}
          loading={isSigningOut}
        >
          <Trans>Login</Trans>
        </Button>
      </div>
    </div>
  );
};
