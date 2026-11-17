import { usePasswordSetupRequest } from '@documenso/lib/client-only/hooks/use-password-setup-request';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon } from 'lucide-react';
import { match } from 'ts-pattern';

/**
 * Compact "send me a setup link" button that reports via toast, for settings
 * cards where the surrounding layout provides the explanation.
 */
export const PasswordSetupRequestButton = () => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const { requestSetupLink, isPending, isSuccess } = usePasswordSetupRequest({
    onSuccess: () => {
      toast({
        title: _(msg`Check your email`),
        description: _(msg`We've sent a link to ${user.email}. Follow it to set your password.`),
        duration: 5000,
      });
    },
    onError: (errorCode) => {
      toast({
        title: _(msg`An error occurred`),
        description: match(errorCode)
          .with('SIGNIN_DISABLED', () => _(msg`Password sign in is disabled for this instance.`))
          .otherwise(() => _(msg`We were unable to send the email. Please try again later.`)),
        variant: 'destructive',
      });
    },
  });

  if (isSuccess) {
    return (
      <Button variant="outline" className="flex-shrink-0 bg-background" disabled>
        <CheckIcon className="mr-2 h-4 w-4" />
        <Trans>Link sent</Trans>
      </Button>
    );
  }

  return (
    <Button variant="outline" className="flex-shrink-0 bg-background" loading={isPending} onClick={requestSetupLink}>
      <Trans>Send setup link</Trans>
    </Button>
  );
};
