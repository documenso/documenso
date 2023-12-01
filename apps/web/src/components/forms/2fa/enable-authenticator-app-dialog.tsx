import { useMemo } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { renderSVG } from 'uqr';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@documenso/ui/primitives/use-toast';

import { RecoveryCodeList } from './recovery-code-list';

export const ZSetupTwoFactorAuthenticationForm = z.object({
  password: z.string().min(6).max(72),
});

export type TSetupTwoFactorAuthenticationForm = z.infer<typeof ZSetupTwoFactorAuthenticationForm>;

export const ZEnableTwoFactorAuthenticationForm = z.object({
  token: z.string(),
});

export type TEnableTwoFactorAuthenticationForm = z.infer<typeof ZEnableTwoFactorAuthenticationForm>;

export type EnableAuthenticatorAppDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const EnableAuthenticatorAppDialog = ({
  open,
  onOpenChange,
}: EnableAuthenticatorAppDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: setupTwoFactorAuthentication, data: setupTwoFactorAuthenticationData } =
    trpc.twoFactorAuthentication.setup.useMutation();

  const { mutateAsync: enableTwoFactorAuthentication, data: enableTwoFactorAuthenticationData } =
    trpc.twoFactorAuthentication.enable.useMutation();

  const setupTwoFactorAuthenticationForm = useForm<TSetupTwoFactorAuthenticationForm>({
    defaultValues: {
      password: '',
    },
    resolver: zodResolver(ZSetupTwoFactorAuthenticationForm),
  });

  const { isSubmitting: isSetupTwoFactorAuthenticationSubmitting } =
    setupTwoFactorAuthenticationForm.formState;

  const enableTwoFactorAuthenticationForm = useForm<TEnableTwoFactorAuthenticationForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZEnableTwoFactorAuthenticationForm),
  });

  const { isSubmitting: isEnableTwoFactorAuthenticationSubmitting } =
    enableTwoFactorAuthenticationForm.formState;

  const step = useMemo(() => {
    if (!setupTwoFactorAuthenticationData || isSetupTwoFactorAuthenticationSubmitting) {
      return 'setup';
    }

    if (!enableTwoFactorAuthenticationData || isEnableTwoFactorAuthenticationSubmitting) {
      return 'enable';
    }

    return 'view';
  }, [
    setupTwoFactorAuthenticationData,
    isSetupTwoFactorAuthenticationSubmitting,
    enableTwoFactorAuthenticationData,
    isEnableTwoFactorAuthenticationSubmitting,
  ]);

  const onSetupTwoFactorAuthenticationFormSubmit = async ({
    password,
  }: TSetupTwoFactorAuthenticationForm) => {
    try {
      await setupTwoFactorAuthentication({ password });
    } catch (_err) {
      toast({
        title: 'Unable to setup two-factor authentication',
        description:
          'We were unable to setup two-factor authentication for your account. Please ensure that you have entered your password correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  const onEnableTwoFactorAuthenticationFormSubmit = async ({
    token,
  }: TEnableTwoFactorAuthenticationForm) => {
    try {
      await enableTwoFactorAuthentication({ code: token });

      toast({
        title: 'Two-factor authentication enabled',
        description:
          'Two-factor authentication has been enabled for your account. You will now be required to enter a code from your authenticator app when signing in.',
      });
    } catch (_err) {
      toast({
        title: 'Unable to setup two-factor authentication',
        description:
          'We were unable to setup two-factor authentication for your account. Please ensure that you have entered your password correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  const onCompleteClick = () => {
    flushSync(() => {
      onOpenChange(false);
    });

    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl md:max-w-xl lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enable Authenticator App</DialogTitle>

          {step === 'setup' && (
            <DialogDescription>
              To enable two-factor authentication, please enter your password below.
            </DialogDescription>
          )}

          {step === 'view' && (
            <DialogDescription>
              Your recovery codes are listed below. Please store them in a safe place.
            </DialogDescription>
          )}
        </DialogHeader>

        {match(step)
          .with('setup', () => {
            return (
              <Form {...setupTwoFactorAuthenticationForm}>
                <form
                  onSubmit={setupTwoFactorAuthenticationForm.handleSubmit(
                    onSetupTwoFactorAuthenticationFormSubmit,
                  )}
                  className="flex flex-col gap-y-4"
                >
                  <FormField
                    name="password"
                    control={setupTwoFactorAuthenticationForm.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete="current-password"
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex w-full items-center justify-between">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>

                    <Button type="submit" loading={isSetupTwoFactorAuthenticationSubmitting}>
                      Continue
                    </Button>
                  </div>
                </form>
              </Form>
            );
          })
          .with('enable', () => (
            <Form {...enableTwoFactorAuthenticationForm}>
              <form
                onSubmit={enableTwoFactorAuthenticationForm.handleSubmit(
                  onEnableTwoFactorAuthenticationFormSubmit,
                )}
                className="flex flex-col gap-y-4"
              >
                <p className="text-muted-foreground text-sm">
                  To enable two-factor authentication, scan the following QR code using your
                  authenticator app.
                </p>

                <div
                  className="flex h-36 justify-center"
                  dangerouslySetInnerHTML={{
                    __html: renderSVG(setupTwoFactorAuthenticationData?.uri ?? ''),
                  }}
                />

                <p className="text-muted-foreground text-sm">
                  If your authenticator app does not support QR codes, you can use the following
                  code instead:
                </p>

                <p className="bg-muted/60 text-muted-foreground rounded-lg p-2 text-center font-mono tracking-widest">
                  {setupTwoFactorAuthenticationData?.secret}
                </p>

                <p className="text-muted-foreground text-sm">
                  Once you have scanned the QR code or entered the code manually, enter the code
                  provided by your authenticator app below.
                </p>

                <FormField
                  name="token"
                  control={enableTwoFactorAuthenticationForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Token</FormLabel>
                      <FormControl>
                        <Input {...field} type="text" value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex w-full items-center justify-between">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>

                  <Button type="submit" loading={isEnableTwoFactorAuthenticationSubmitting}>
                    Enable 2FA
                  </Button>
                </div>
              </form>
            </Form>
          ))
          .with('view', () => (
            <div>
              {enableTwoFactorAuthenticationData?.recoveryCodes && (
                <RecoveryCodeList recoveryCodes={enableTwoFactorAuthenticationData.recoveryCodes} />
              )}

              <div className="mt-4 flex w-full flex-row-reverse items-center justify-between">
                <Button type="button" onClick={() => onCompleteClick()}>
                  Complete
                </Button>
              </div>
            </div>
          ))
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};
