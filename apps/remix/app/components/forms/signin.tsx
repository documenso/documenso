import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

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

export const SignInForm = ({ className, returnTo }: SignInFormProps) => {
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

  const onSignInWithMicrosoftClick = async () => {
    try {
      setIsLoading(true);

      await authClient.microsoft.signIn({
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

  return (
    <div className={cn('flex w-full flex-col gap-y-4', className)}>
      <Button
        type="button"
        size="lg"
        loading={isLoading}
        className="dark:bg-documenso dark:hover:opacity-90"
        onClick={onSignInWithMicrosoftClick}
      >
        {!isLoading && (
          <img className="mr-2 h-4 w-4" alt="Microsoft Logo" src={'/static/microsoft.svg'} />
        )}
        <Trans>Sign in with Microsoft</Trans>
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        <Trans>Sign in with your Gnarlysoft Microsoft account to continue.</Trans>
      </p>
    </div>
  );
};
