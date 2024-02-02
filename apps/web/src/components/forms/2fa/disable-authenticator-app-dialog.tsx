import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZDisableTwoFactorAuthenticationForm = z.object({
  password: z.string().min(6).max(72),
  backupCode: z.string(),
});

export type TDisableTwoFactorAuthenticationForm = z.infer<
  typeof ZDisableTwoFactorAuthenticationForm
>;

export type DisableAuthenticatorAppDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DisableAuthenticatorAppDialog = ({
  open,
  onOpenChange,
}: DisableAuthenticatorAppDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: disableTwoFactorAuthentication } =
    trpc.twoFactorAuthentication.disable.useMutation();

  const disableTwoFactorAuthenticationForm = useForm<TDisableTwoFactorAuthenticationForm>({
    defaultValues: {
      password: '',
      backupCode: '',
    },
    resolver: zodResolver(ZDisableTwoFactorAuthenticationForm),
  });

  const { isSubmitting: isDisableTwoFactorAuthenticationSubmitting } =
    disableTwoFactorAuthenticationForm.formState;

  const onDisableTwoFactorAuthenticationFormSubmit = async ({
    password,
    backupCode,
  }: TDisableTwoFactorAuthenticationForm) => {
    try {
      await disableTwoFactorAuthentication({ password, backupCode });

      toast({
        title: 'Two-factor authentication disabled',
        description:
          'Two-factor authentication has been disabled for your account. You will no longer be required to enter a code from your authenticator app when signing in.',
      });

      flushSync(() => {
        onOpenChange(false);
      });

      router.refresh();
    } catch (_err) {
      toast({
        title: 'Unable to disable two-factor authentication',
        description:
          'We were unable to disable two-factor authentication for your account. Please ensure that you have entered your password and backup code correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl md:max-w-xl lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>Disable Authenticator App</DialogTitle>

          <DialogDescription>
            To disable the Authenticator App for your account, please enter your password and a
            backup code. If you do not have a backup code available, please contact support.
          </DialogDescription>
        </DialogHeader>

        <Form {...disableTwoFactorAuthenticationForm}>
          <form
            onSubmit={disableTwoFactorAuthenticationForm.handleSubmit(
              onDisableTwoFactorAuthenticationFormSubmit,
            )}
            className="flex flex-col gap-y-4"
          >
            <fieldset
              className="flex flex-col gap-y-4"
              disabled={isDisableTwoFactorAuthenticationSubmitting}
            >
              <FormField
                name="password"
                control={disableTwoFactorAuthenticationForm.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        autoComplete="current-password"
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="backupCode"
                control={disableTwoFactorAuthenticationForm.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Backup Code</FormLabel>
                    <FormControl>
                      <Input {...field} type="text" value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>

              <Button
                type="submit"
                variant="destructive"
                loading={isDisableTwoFactorAuthenticationSubmitting}
              >
                Disable 2FA
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
