import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZDisable2FAForm = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TDisable2FAForm = z.infer<typeof ZDisable2FAForm>;

export const DisableAuthenticatorAppDialog = () => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [twoFactorDisableMethod, setTwoFactorDisableMethod] = useState<'totp' | 'backup'>('totp');

  const disable2FAForm = useForm<TDisable2FAForm>({
    defaultValues: {
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZDisable2FAForm),
  });

  const onCloseTwoFactorDisableDialog = () => {
    disable2FAForm.reset();

    setIsOpen(!isOpen);
  };

  const onToggleTwoFactorDisableMethodClick = () => {
    const method = twoFactorDisableMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      disable2FAForm.setValue('backupCode', '');
    }

    if (method === 'backup') {
      disable2FAForm.setValue('totpCode', '');
    }

    setTwoFactorDisableMethod(method);
  };

  const { isSubmitting: isDisable2FASubmitting } = disable2FAForm.formState;

  const onDisable2FAFormSubmit = async ({ totpCode, backupCode }: TDisable2FAForm) => {
    try {
      await authClient.twoFactor.disable({ totpCode, backupCode });

      toast({
        title: _(msg`Two-factor authentication disabled`),
        description: _(
          msg`Two-factor authentication has been disabled for your account. You will no longer be required to enter a code from your authenticator app when signing in.`,
        ),
      });

      flushSync(() => {
        onCloseTwoFactorDisableDialog();
      });

      await refreshSession();
    } catch (_err) {
      toast({
        title: _(msg`Unable to disable two-factor authentication`),
        description: _(
          msg`We were unable to disable two-factor authentication for your account. Please ensure that you have entered your password and backup code correctly and try again.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseTwoFactorDisableDialog}>
      <DialogTrigger asChild={true}>
        <Button className="flex-shrink-0" variant="destructive">
          <Trans>Disable 2FA</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Disable 2FA</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Please provide a token from the authenticator, or a backup code. If you do not have a
              backup code available, please contact support.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...disable2FAForm}>
          <form onSubmit={disable2FAForm.handleSubmit(onDisable2FAFormSubmit)}>
            <fieldset className="flex flex-col gap-y-4" disabled={isDisable2FASubmitting}>
              {twoFactorDisableMethod === 'totp' && (
                <FormField
                  name="totpCode"
                  control={disable2FAForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <PinInput {...field} value={field.value ?? ''} maxLength={6}>
                          {Array(6)
                            .fill(null)
                            .map((_, i) => (
                              <PinInputGroup key={i}>
                                <PinInputSlot index={i} />
                              </PinInputGroup>
                            ))}
                        </PinInput>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {twoFactorDisableMethod === 'backup' && (
                <FormField
                  control={disable2FAForm.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Backup Code</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onToggleTwoFactorDisableMethodClick}
                >
                  {twoFactorDisableMethod === 'totp' ? (
                    <Trans>Use Backup Code</Trans>
                  ) : (
                    <Trans>Use Authenticator</Trans>
                  )}
                </Button>

                <Button type="submit" variant="destructive" loading={isDisable2FASubmitting}>
                  <Trans>Disable 2FA</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
