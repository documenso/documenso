import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FcGoogle } from 'react-icons/fc';

import { authClient } from '@documenso/auth/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

const LOGIN_REDIRECT_PATH = '/';

export type SignInFormProps = {
  className?: string;
  initialEmail?: string;
  isGoogleSSOEnabled?: boolean;
  isMicrosoftSSOEnabled?: boolean;
  isOIDCSSOEnabled?: boolean;
  oidcProviderLabel?: string;
  returnTo?: string;
};

export const SignInForm = ({ className, isGoogleSSOEnabled, returnTo }: SignInFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const redirectPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return LOGIN_REDIRECT_PATH;
    }

    let url = new URL(returnTo || LOGIN_REDIRECT_PATH, window.location.origin);

    if (url.origin !== window.location.origin) {
      url = new URL(LOGIN_REDIRECT_PATH, window.location.origin);
    }

    return url.toString();
  }, [returnTo]);

  const onSignInWithGoogleClick = async () => {
    try {
      setIsLoading(true);

      await authClient.google.signIn({
        redirectPath,
      });
    } catch {
      setIsLoading(false);

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to sign you in. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  if (!isGoogleSSOEnabled) {
    return (
      <div className={cn('flex w-full flex-col gap-y-4', className)}>
        <p className="text-center text-sm text-muted-foreground">
          <Trans>Google sign-in is not configured. Please contact your administrator.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col gap-y-4', className)}>
      <Button
        type="button"
        size="lg"
        loading={isLoading}
        className="dark:bg-documenso dark:hover:opacity-90"
        onClick={onSignInWithGoogleClick}
      >
        {!isLoading && <FcGoogle className="mr-2 h-5 w-5" />}
        <Trans>Sign in with Google</Trans>
      </Button>
    </div>
  );
};
