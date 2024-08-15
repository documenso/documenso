'use client';

import { useState } from 'react';

import { signOut } from 'next-auth/react';

import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const DirectTemplateAuthPageView = () => {
  const { toast } = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async () => {
    try {
      setIsSigningOut(true);

      await signOut({
        callbackUrl: '/signin',
      });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'We were unable to log you out at this time.',
        duration: 10000,
        variant: 'destructive',
      });
    }

    setIsSigningOut(false);
  };

  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <h1 className="text-3xl font-semibold">Authentication required</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          You need to be logged in to view this page.
        </p>

        <Button
          className="mt-4 w-full"
          type="submit"
          onClick={async () => handleChangeAccount()}
          loading={isSigningOut}
        >
          Login
        </Button>
      </div>
    </div>
  );
};
